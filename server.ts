import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import expressWs from "express-ws";
import { spawn, execSync, ChildProcess } from "child_process";
import readline from "readline";
import { QuantEngineSimulator } from "./engine_simulator";

const isWin = process.platform === "win32";

function getEnginePath(): string {
  const binaryName = isWin ? "mm_engine.exe" : "mm_engine";
  const searchCandidates = [
    path.resolve(process.cwd(), "cpp", binaryName),
    path.resolve(process.cwd(), "cpp", "build", binaryName),
    path.resolve(process.cwd(), "cpp", "build", "Release", binaryName),
    path.resolve(process.cwd(), "cpp", "build", "Debug", binaryName),
    path.resolve(process.cwd(), binaryName),
  ];

  for (const candidate of searchCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  if (isWin) {
    const altCandidate = path.resolve(process.cwd(), "cpp", "mm_engine");
    if (fs.existsSync(altCandidate)) {
      return altCandidate;
    }
  }

  return path.resolve(process.cwd(), "cpp", binaryName);
}

function checkCompilerAvailable(): boolean {
  try {
    const cmd = isWin ? "where g++" : "which g++ || which clang++ || which cmake";
    execSync(cmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function tryCompileBinary(): boolean {
  const target = getEnginePath();
  if (fs.existsSync(target)) return true;

  if (!checkCompilerAvailable()) {
    return false;
  }

  console.log("[Engine Auto-Build] Attempting on-the-fly C++ compilation...");
  try {
    execSync("node scripts/build_cpp.js", { stdio: "inherit" });
    return fs.existsSync(target);
  } catch (err: any) {
    console.warn("[Engine Auto-Build Warning] Compilation command failed:", err.message);
    return false;
  }
}

async function startServer() {
  const enginePath = getEnginePath();

  // Try auto-compilation if binary is missing and compiler is present
  if (!fs.existsSync(enginePath)) {
    tryCompileBinary();
  }

  // Ensure executable permissions if binary exists
  if (!isWin && fs.existsSync(enginePath)) {
    try {
      execSync(`chmod +x "${enginePath}"`);
      console.log(`[Platform] Permissions configured: chmod +x "${enginePath}"`);
    } catch (e: any) {
      console.warn(`[Platform] chmod warning for ${enginePath}:`, e.message || e);
    }
  }

  const { app, getWss } = expressWs(express());
  const PORT = 3000;

  let activeProcess: ChildProcess | null = null;
  let activeArgs: string[] = [];
  const embeddedSimulator = new QuantEngineSimulator();
  let isUsingEmbeddedSimulator = false;

  const broadcast = (payload: { type: string; data: string }) => {
    const raw = JSON.stringify(payload);
    getWss().clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(raw);
      }
    });
  };

  // Wire up embedded simulator callbacks
  embeddedSimulator.setCallbacks(
    (tickData: string) => {
      broadcast({ type: "engine_data", data: tickData });
    },
    (logMsg: string) => {
      broadcast({ type: "engine_log", data: logMsg });
    }
  );

  // Health check API
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      engine: isUsingEmbeddedSimulator
        ? "embedded_simulator"
        : activeProcess
        ? "cpp_native_process"
        : "idle",
      mode: isUsingEmbeddedSimulator ? "embedded" : "native",
      uptime: process.uptime(),
    });
  });

  const stopActiveEngines = () => {
    embeddedSimulator.stop();
    if (activeProcess) {
      console.log("[Engine] Stopping active native process...");
      try {
        if (isWin && activeProcess.pid) {
          try {
            execSync(`taskkill /pid ${activeProcess.pid} /T /F`, { stdio: "ignore" });
          } catch {
            activeProcess.kill();
          }
        } else {
          activeProcess.kill();
        }
      } catch (e: any) {
        console.warn("[Engine] Error stopping process:", e.message || e);
      }
      activeProcess = null;
    }
  };

  const startEngine = (args: string[]) => {
    activeArgs = args;
    stopActiveEngines();

    const currentEnginePath = getEnginePath();
    const hasBinary = fs.existsSync(currentEnginePath);

    // Parse options from args
    let strategy = "FixedSpreadMM";
    let seed = 42;
    let duration = 0;
    let replay = "";

    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--strategy" && i + 1 < args.length) strategy = args[i + 1];
      else if (args[i] === "--seed" && i + 1 < args.length) seed = parseInt(args[i + 1], 10) || 42;
      else if (args[i] === "--duration" && i + 1 < args.length) duration = parseInt(args[i + 1], 10) || 0;
      else if (args[i] === "--replay" && i + 1 < args.length) replay = args[i + 1];
    }

    if (!hasBinary) {
      console.log(`[Engine Seamless Mode] C++ binary not present in container. Activating high-performance Embedded Quant Engine.`);
      isUsingEmbeddedSimulator = true;
      broadcast({
        type: "engine_log",
        data: `[Engine Mode] Running resilient Embedded Quant Simulator (${strategy}, seed=${seed}, duration=${duration})`,
      });
      embeddedSimulator.start({ strategy, seed, duration, replay });
      return;
    }

    // Launch native C++ binary
    isUsingEmbeddedSimulator = false;
    console.log(`[Engine] Launching native C++ binary: "${currentEnginePath}"`, args);

    let child: ChildProcess;
    try {
      child = spawn(currentEnginePath, args, {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (e: any) {
      console.warn(`[Engine Spawn Fallback] Could not spawn native process, switching to embedded:`, e.message);
      isUsingEmbeddedSimulator = true;
      embeddedSimulator.start({ strategy, seed, duration, replay });
      return;
    }

    activeProcess = child;

    const rl = readline.createInterface({
      input: child.stdout!,
      terminal: false,
    });

    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      if (trimmed.startsWith("{")) {
        try {
          JSON.parse(trimmed);
          broadcast({ type: "engine_data", data: trimmed });
        } catch {
          broadcast({ type: "engine_log", data: trimmed });
        }
      } else {
        broadcast({ type: "engine_log", data: trimmed });
      }
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      const errStr = chunk.toString().trim();
      if (errStr) {
        console.error(`[Engine STDERR] ${errStr}`);
        broadcast({ type: "engine_log", data: `[STDERR] ${errStr}` });
      }
    });

    child.on("error", (error: any) => {
      console.error(`[Engine Process Error]`, error);
      broadcast({
        type: "engine_log",
        data: `Native process error, falling back to embedded simulator: ${error.message}`,
      });
      isUsingEmbeddedSimulator = true;
      embeddedSimulator.start({ strategy, seed, duration, replay });
    });

    child.on("close", (code, signal) => {
      console.log(`[Engine] Process finished with exit code ${code}, signal ${signal}`);
      if (activeProcess === child) {
        activeProcess = null;
      }
      broadcast({
        type: "engine_log",
        data: `Simulation process finished (code: ${code}${signal ? `, signal: ${signal}` : ""})`,
      });
    });
  };

  const sessionMap = new Map<string, number>();
  let globalTraderCounter = 1000;

  app.ws("/ws/market", (ws: any, _req) => {
    ws.session = { traderId: null, authenticated: false };

    // Launch default simulation if none running
    if (!activeProcess && !isUsingEmbeddedSimulator) {
      startEngine(["--strategy", "FixedSpreadMM", "--seed", "42", "--duration", "0"]);
    }

    ws.on("message", (msg) => {
      try {
        const rawStr = msg.toString();
        let command: any;
        try {
          command = JSON.parse(rawStr);
        } catch (parseErr: any) {
          console.error("[WS Security] Uncaught JSON Parse Error (DoS prevented):", parseErr.message);
          ws.send(JSON.stringify({ type: "ERROR", message: "Malformed JSON frame rejected" }));
          return;
        }

        if (!command || typeof command.type !== "string") {
          ws.send(JSON.stringify({ type: "ERROR", message: "Invalid command structure" }));
          return;
        }

        if (command.type === "INIT_SESSION") {
          const token = String(command.session_token || "");
          // Strict validation: token must be a valid hex/alphanumeric cryptographic session token (min 16 chars)
          const isValidToken = /^[a-zA-Z0-9_\-\.]{16,128}$/.test(token);
          if (!isValidToken) {
            ws.send(JSON.stringify({ type: "AUTH_ERROR", message: "Invalid or missing cryptographic session token" }));
            return;
          }
          if (!sessionMap.has(token)) {
            sessionMap.set(token, ++globalTraderCounter);
          }
          ws.session.traderId = sessionMap.get(token)!;
          ws.session.authenticated = true;
          ws.send(JSON.stringify({ type: "AUTH_SUCCESS", trader_id: ws.session.traderId }));
          console.log(`[WS Auth] Secure session established for traderId=${ws.session.traderId}`);
          return;
        }

        // Require authentication for trading actions
        if (!ws.session.authenticated || !ws.session.traderId) {
          ws.send(JSON.stringify({ type: "AUTH_ERROR", message: "Unauthorized: INIT_SESSION required first" }));
          return;
        }

        if (command.type === "START_EXPERIMENT") {
          const validStrategies = ["FixedSpreadMM", "InventoryAware", "VolatilityAdaptive", "RegimeAdaptive"];
          const strategy = validStrategies.includes(command.strategy) ? command.strategy : "FixedSpreadMM";
          
          const rawSeed = Number(command.seed);
          const seed = (Number.isInteger(rawSeed) && rawSeed >= 0) ? rawSeed : 42;
          
          const rawDuration = Number(command.duration);
          const duration = (Number.isInteger(rawDuration) && rawDuration >= 0) ? Math.min(100000, rawDuration) : 0;
          
          const args: string[] = ["--strategy", strategy, "--seed", seed.toString(), "--duration", duration.toString()];
          
          if (command.replay && typeof command.replay === "string") {
            const REPLAY_DIR = path.resolve(process.cwd(), "cpp");
            const sanitizedInput = path.basename(command.replay);
            const targetPath = path.resolve(REPLAY_DIR, sanitizedInput);
            if (targetPath.startsWith(REPLAY_DIR) && fs.existsSync(targetPath)) {
              args.push("--replay", targetPath);
            }
          }

          console.log(`[WS] START_EXPERIMENT validated: strategy=${strategy} seed=${seed} duration=${duration}`);
          startEngine(args);
        } else if (command.type === "UPDATE_PARAMS") {
          const sanitizedParams = {
            type: "UPDATE_PARAMS",
            gamma: typeof command.gamma === "number" ? Math.max(0.01, Math.min(2.0, command.gamma)) : undefined,
            spread: typeof command.spread === "number" ? Math.max(0.01, Math.min(2.0, command.spread)) : undefined,
            size: typeof command.size === "number" ? Math.max(1, Math.min(1000, command.size)) : undefined,
            max_pos: typeof command.max_pos === "number" ? Math.max(10, Math.min(10000, command.max_pos)) : undefined,
            skew_factor: typeof command.skew_factor === "number" ? Math.max(0.001, Math.min(1.0, command.skew_factor)) : undefined,
          };
          console.log("[WS] UPDATE_PARAMS validated:", sanitizedParams);
          if (isUsingEmbeddedSimulator) {
            embeddedSimulator.updateParams(sanitizedParams);
          } else if (activeProcess && activeProcess.stdin && !activeProcess.stdin.destroyed) {
            activeProcess.stdin.write(JSON.stringify(sanitizedParams) + "\n");
          }
        } else if (command.type === "CANCEL_ORDER") {
          // CTA-07: Strict owner validation derived exclusively from verified session context
          const orderId = Number(command.order_id);
          const traderId = ws.session.traderId;
          if (Number.isInteger(orderId) && orderId > 0) {
            const cancelPayload = {
              type: "CANCEL_ORDER",
              order_id: orderId,
              trader_id: traderId,
              enforce_ownership: true
            };
            console.log("[WS] CANCEL_ORDER validated with session-bound ownership:", cancelPayload);
            if (activeProcess && activeProcess.stdin && !activeProcess.stdin.destroyed) {
              activeProcess.stdin.write(JSON.stringify(cancelPayload) + "\n");
            }
          } else {
            console.warn("[WS Security] Rejected malformed CANCEL_ORDER request");
          }
        }
      } catch (err: any) {
        console.error("[WS Critical Error] Outer message handler caught exception:", err.message || err);
      }
    });

    ws.on("close", () => {
      console.log("[WS] Client disconnected");
      setTimeout(() => {
        let openCount = 0;
        getWss().clients.forEach((c) => {
          if (c.readyState === 1) openCount++;
        });
        if (openCount === 0) {
          console.log("[WS] No active WebSocket clients remaining. Pausing engine.");
          stopActiveEngines();
          isUsingEmbeddedSimulator = false;
        }
      }, 500);
    });

    ws.on("error", (err) => {
      console.error("[WS] Client error:", err);
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

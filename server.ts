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

  app.ws("/ws/market", (ws, _req) => {
    console.log("[WS] Client connected to /ws/market");

    // Launch default simulation if none running
    if (!activeProcess && !isUsingEmbeddedSimulator) {
      startEngine(["--strategy", "FixedSpreadMM", "--seed", "42", "--duration", "0"]);
    }

    ws.on("message", (msg) => {
      try {
        const command = JSON.parse(msg.toString());
        if (command.type === "START_EXPERIMENT") {
          const args: string[] = [];
          if (command.strategy) args.push("--strategy", command.strategy);
          if (command.seed !== undefined && command.seed !== null) args.push("--seed", command.seed.toString());
          if (command.duration !== undefined && command.duration !== null) args.push("--duration", command.duration.toString());
          if (command.replay) args.push("--replay", command.replay);

          console.log(`[WS] START_EXPERIMENT: strategy=${command.strategy} seed=${command.seed} duration=${command.duration}`);
          startEngine(args);
        } else if (command.type === "UPDATE_PARAMS") {
          console.log("[WS] UPDATE_PARAMS:", command);
          if (isUsingEmbeddedSimulator) {
            embeddedSimulator.updateParams(command);
          } else if (activeProcess && activeProcess.stdin && !activeProcess.stdin.destroyed) {
            activeProcess.stdin.write(JSON.stringify(command) + "\n");
          }
        }
      } catch (e: any) {
        console.error("[WS] Failed to parse message:", e.message || e);
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

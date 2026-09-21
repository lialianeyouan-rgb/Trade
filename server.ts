import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import expressWs from "express-ws";
import { spawn, execSync, ChildProcess } from "child_process";
import readline from "readline";

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
    // Fallback on Windows if compiled without extension
    const altCandidate = path.resolve(process.cwd(), "cpp", "mm_engine");
    if (fs.existsSync(altCandidate)) {
      return altCandidate;
    }
  }

  // Default target path
  return path.resolve(process.cwd(), "cpp", binaryName);
}

async function startServer() {
  const enginePath = getEnginePath();

  // On non-Windows OS, ensure executable permissions
  if (!isWin) {
    if (fs.existsSync(enginePath)) {
      try {
        execSync(`chmod +x "${enginePath}"`);
        console.log(`[Platform] Permissions configured: chmod +x "${enginePath}"`);
      } catch (e: any) {
        console.warn(`[Platform] chmod warning for ${enginePath}:`, e.message || e);
      }
    } else {
      console.warn(`[Platform] Engine binary not found at "${enginePath}". Will look again at runtime.`);
    }
  } else {
    console.log(`[Platform] Running on Windows (win32). Engine target: "${enginePath}". Skipping chmod.`);
  }

  const { app, getWss } = expressWs(express());
  const PORT = 3000;

  // JSON REST API endpoints
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      engine: activeProcess ? "running" : "idle",
      uptime: process.uptime(),
    });
  });

  let activeProcess: ChildProcess | null = null;
  let activeArgs: string[] = [];

  const broadcast = (payload: { type: string; data: string }) => {
    const raw = JSON.stringify(payload);
    getWss().clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(raw);
      }
    });
  };

  const startEngine = (args: string[]) => {
    activeArgs = args;

    if (activeProcess) {
      console.log("[Engine] Stopping active engine process...");
      try {
        if (isWin && activeProcess.pid) {
          // On Windows, tree-kill or standard kill
          try {
            execSync(`taskkill /pid ${activeProcess.pid} /T /F`, { stdio: "ignore" });
          } catch {
            activeProcess.kill();
          }
        } else {
          activeProcess.kill();
        }
      } catch (e: any) {
        console.warn("[Engine] Error while killing active process:", e.message || e);
      }
      activeProcess = null;
    }

    const currentEnginePath = getEnginePath();
    if (!fs.existsSync(currentEnginePath)) {
      const err = `[Engine Error] Binary not found at "${currentEnginePath}". Run 'npm run build:cpp' to compile.`;
      console.error(err);
      broadcast({ type: "engine_log", data: err });
      return;
    }

    console.log(`[Engine] Launching engine (${isWin ? "Windows" : "Unix"}): "${currentEnginePath}"`, args);

    let child: ChildProcess;
    try {
      child = spawn(currentEnginePath, args, {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (e: any) {
      console.error(`[Engine Spawn Exception]`, e);
      broadcast({ type: "engine_log", data: `Spawn exception: ${e.message}` });
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
      if (error.code === "ENOENT") {
        console.error(`[Engine Process Error] Binary "${currentEnginePath}" not found.`);
      }
      broadcast({
        type: "engine_log",
        data: `Engine error: ${error.message} (code: ${error.code || "UNKNOWN"})`,
      });
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

  app.ws("/ws/market", (ws, req) => {
    console.log("[WS] Client connected to /ws/market");

    // If no engine is currently running, launch default
    if (!activeProcess) {
      startEngine([]);
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
          
          console.log(`[WS] START_EXPERIMENT received: strategy=${command.strategy} seed=${command.seed} duration=${command.duration} replay=${command.replay}`);
          startEngine(args);
        } else if (command.type === "UPDATE_PARAMS") {
          console.log("[WS] Forwarding UPDATE_PARAMS to engine stdin:", command);
          if (activeProcess && activeProcess.stdin && !activeProcess.stdin.destroyed) {
            activeProcess.stdin.write(JSON.stringify(command) + "\n");
          }
        }
      } catch (e: any) {
        console.error("[WS] Failed to parse message:", e.message || e);
      }
    });

    ws.on("close", () => {
      console.log("[WS] Client disconnected");
      // Check if all clients disconnected
      setTimeout(() => {
        let openCount = 0;
        getWss().clients.forEach((c) => {
          if (c.readyState === 1) openCount++;
        });
        if (openCount === 0 && activeProcess) {
          console.log("[WS] No active WebSocket clients remaining. Shutting down engine.");
          try {
            activeProcess.kill();
          } catch {}
          activeProcess = null;
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
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

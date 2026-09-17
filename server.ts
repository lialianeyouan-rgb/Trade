import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import expressWs from "express-ws";
import { spawn, execSync, ChildProcess } from "child_process";
import readline from "readline";

const ENGINE_PATH = "./cpp/mm_engine";

async function startServer() {
  try {
    execSync(`chmod +x ${ENGINE_PATH}`);
  } catch (e) {
    console.error("Failed to make engine executable:", e);
  }

  const { app, getWss } = expressWs(express());
  const PORT = 3000;

  let activeProcess: ChildProcess | null = null;
  let isAlive = true;

  app.ws("/ws/market", (ws, req) => {
    isAlive = true;

    const startEngine = (args: string[]) => {
      if (activeProcess) {
        activeProcess.kill();
      }
      
      const process = spawn(ENGINE_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      activeProcess = process;
      
      const rl = readline.createInterface({
        input: process.stdout,
        terminal: false
      });

      let queue: string[] = [];
      let isProcessing = false;

      const processQueue = async () => {
        if (isProcessing) return;
        isProcessing = true;
        while (queue.length > 0 && isAlive && ws.readyState === 1) {
          const line = queue.shift();
          if (line) {
            const lineStr = line.trim();
            if (lineStr) {
              if (lineStr.startsWith("{")) {
                try {
                  JSON.parse(lineStr);
                  ws.send(JSON.stringify({ type: "engine_data", data: lineStr }));
                } catch (e) {
                  ws.send(JSON.stringify({ type: "engine_log", data: lineStr }));
                }
              } else {
                ws.send(JSON.stringify({ type: "engine_log", data: lineStr }));
              }
            }
          }
          await new Promise(r => setTimeout(r, 5)); // 5ms throttle
        }
        isProcessing = false;
      };

      rl.on("line", (line) => {
        queue.push(line);
        processQueue();
      });

      process.on("error", (error) => {
        console.error("Engine process error:", error);
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: "engine_log", data: `Error starting engine: ${error.message}` }));
        }
      });
    };

    // Start default infinite run
    startEngine([]);

    ws.on("message", (msg) => {
        try {
            const command = JSON.parse(msg.toString());
            if (command.type === "START_EXPERIMENT") {
                const args = [];
                if (command.strategy) args.push("--strategy", command.strategy);
                if (command.seed) args.push("--seed", command.seed.toString());
                if (command.duration) args.push("--duration", command.duration.toString());
                startEngine(args);
            }
        } catch(e) {
            console.error("Failed to parse WS message", e);
        }
    });

    ws.on("close", () => {
      isAlive = false;
      if (activeProcess) activeProcess.kill();
    });
    
    ws.on("error", () => {
      isAlive = false;
      if (activeProcess) activeProcess.kill();
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

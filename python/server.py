from fastapi import FastAPI, WebSocket
import asyncio
import subprocess
import json

app = FastAPI()

# Path to the compiled C++ engine
ENGINE_PATH = "./build/cpp/mm_engine"

@app.websocket("/ws/market")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    # Run the engine as a subprocess and stream output
    process = subprocess.Popen(
        [ENGINE_PATH],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    try:
        while True:
            line = process.stdout.readline()
            if not line:
                break
            line_str = line.strip()
            if not line_str:
                continue
                
            if line_str.startswith("{"):
                try:
                    # Validate it's actually JSON before sending as JSON string
                    json.loads(line_str)
                    await websocket.send_json({"type": "engine_data", "data": line_str})
                except json.JSONDecodeError:
                    await websocket.send_json({"type": "engine_log", "data": line_str})
            else:
                await websocket.send_json({"type": "engine_log", "data": line_str})
                
            await asyncio.sleep(0.01) # throttled stream
    finally:
        process.terminate()
        await websocket.close()

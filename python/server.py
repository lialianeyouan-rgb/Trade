import sys
import os
from pathlib import Path
from fastapi import FastAPI, WebSocket
import asyncio
import subprocess
import json

app = FastAPI()

def get_engine_path() -> str:
    is_win = sys.platform == "win32"
    binary_name = "mm_engine.exe" if is_win else "mm_engine"
    cwd = Path.cwd()
    search_candidates = [
        cwd / "cpp" / binary_name,
        cwd / "cpp" / "build" / binary_name,
        cwd / "cpp" / "build" / "Release" / binary_name,
        cwd / "cpp" / "build" / "Debug" / binary_name,
        cwd / "build" / "cpp" / binary_name,
        cwd / binary_name,
    ]
    for cand in search_candidates:
        if cand.exists():
            return str(cand)
    if is_win:
        alt = cwd / "cpp" / "mm_engine"
        if alt.exists():
            return str(alt)
    return str(cwd / "cpp" / binary_name)

@app.websocket("/ws/market")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    engine_path = get_engine_path()

    if not os.path.exists(engine_path):
        err_msg = f"[Engine Error] Binary not found at '{engine_path}'. Please compile using 'npm run build:cpp'."
        await websocket.send_json({"type": "engine_log", "data": err_msg})
        await websocket.close()
        return

    # Run the engine as a subprocess and stream output
    try:
        process = subprocess.Popen(
            [engine_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
    except Exception as e:
        await websocket.send_json({"type": "engine_log", "data": f"[Engine Spawn Error]: {str(e)}"})
        await websocket.close()
        return

    
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

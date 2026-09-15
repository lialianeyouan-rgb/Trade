import subprocess
import json
import os

class ExperimentRunner:
    def __init__(self, engine_path):
        self.engine_path = engine_path

    def run(self, experiment_id, config):
        print(f"Running experiment {experiment_id}...")
        # Serialize config to json or pass as env vars? 
        # For now, just run the engine.
        result = subprocess.run([self.engine_path], capture_output=True, text=True)
        # In a real setup, parse the output for P&L/Metrics
        return {"id": experiment_id, "output": result.stdout}

# Example usage (stub)
if __name__ == "__main__":
    runner = ExperimentRunner("./build/cpp/mm_engine")
    print(runner.run("EXP_001", {"spread": 0.1}))

import random

def run_stress_test(strategy_params, perturbation):
    print(f"Running stress test with {perturbation}")
    # Simulate perturbing params
    return {"status": "passed" if random.random() > 0.1 else "failed"}

if __name__ == "__main__":
    print(run_stress_test({}, "spread +10%"))

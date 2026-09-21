import { execSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isWin = process.platform === "win32";
const cppDir = path.resolve(__dirname, "..", "cpp");
const targetBinaryName = isWin ? "mm_engine.exe" : "mm_engine";
const targetBinaryPath = path.join(cppDir, targetBinaryName);

console.log(`[build:cpp] Platform: ${process.platform} (${isWin ? "Windows" : "Unix/macOS"})`);
console.log(`[build:cpp] Target binary: ${targetBinaryPath}`);

const sources = [
  "main.cpp",
  "orderbook/order_book.cpp",
  "matching/matching_engine.cpp",
  "simulator/market.cpp",
  "simulator/noise_trader.cpp",
  "simulator/fixed_spread_mm.cpp",
  "simulator/risk_engine.cpp",
  "simulator/feature_engine.cpp",
  "simulator/inventory_aware_mm.cpp",
  "simulator/volatility_adaptive_mm.cpp",
  "simulator/order_flow_aware_mm.cpp",
  "simulator/regime_adaptive_mm.cpp",
  "simulator/momentum_trader.cpp",
];

function commandExists(cmd) {
  try {
    const checkCmd = isWin ? `where ${cmd}` : `which ${cmd}`;
    execSync(checkCmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function compileWithCMake() {
  console.log("[build:cpp] Attempting build with CMake...");
  const buildDir = path.join(cppDir, "build");
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  execSync(`cmake -B "${buildDir}" -S "${cppDir}"`, { stdio: "inherit" });
  execSync(`cmake --build "${buildDir}" --config Release`, { stdio: "inherit" });

  const candidateOutputs = [
    path.join(cppDir, targetBinaryName),
    path.join(buildDir, targetBinaryName),
    path.join(buildDir, "Release", targetBinaryName),
    path.join(buildDir, "Debug", targetBinaryName),
  ];

  for (const cand of candidateOutputs) {
    if (fs.existsSync(cand)) {
      if (cand !== targetBinaryPath) {
        fs.copyFileSync(cand, targetBinaryPath);
      }
      return true;
    }
  }
  return false;
}

function compileWithGnuOrClang(compiler) {
  console.log(`[build:cpp] Attempting build with ${compiler}...`);
  const includes = ["-Iorderbook", "-Imatching", "-Isimulator"];
  const args = [
    "-std=c++20",
    ...sources,
    ...includes,
    "-O3",
    "-o",
    targetBinaryName,
  ];

  const result = spawnSync(compiler, args, {
    cwd: cppDir,
    stdio: "inherit",
    shell: true,
  });

  return result.status === 0 && fs.existsSync(targetBinaryPath);
}

function compileWithMSVC() {
  console.log("[build:cpp] Attempting build with MSVC cl.exe...");
  const includes = ["/Iorderbook", "/Imatching", "/Isimulator"];
  const args = [
    "/EHsc",
    "/std:c++20",
    "/O2",
    ...sources,
    ...includes,
    `/Fe:${targetBinaryName}`,
  ];

  const result = spawnSync("cl.exe", args, {
    cwd: cppDir,
    stdio: "inherit",
    shell: true,
  });

  return result.status === 0 && fs.existsSync(targetBinaryPath);
}

function build() {
  let success = false;

  if (commandExists("cmake")) {
    try {
      success = compileWithCMake();
    } catch (e) {
      console.warn("[build:cpp] CMake build failed, falling back to direct compiler...", e.message);
    }
  }

  if (!success && commandExists("g++")) {
    try {
      success = compileWithGnuOrClang("g++");
    } catch (e) {
      console.warn("[build:cpp] g++ build failed:", e.message);
    }
  }

  if (!success && commandExists("clang++")) {
    try {
      success = compileWithGnuOrClang("clang++");
    } catch (e) {
      console.warn("[build:cpp] clang++ build failed:", e.message);
    }
  }

  if (!success && isWin && commandExists("cl")) {
    try {
      success = compileWithMSVC();
    } catch (e) {
      console.warn("[build:cpp] MSVC build failed:", e.message);
    }
  }

  if (success) {
    if (!isWin) {
      try {
        execSync(`chmod +x "${targetBinaryPath}"`);
      } catch (e) {
        console.warn("[build:cpp] Could not chmod +x:", e.message);
      }
    }
    console.log(`[build:cpp] SUCCESS: Engine compiled at ${targetBinaryPath}`);
    process.exit(0);
  }

  if (fs.existsSync(targetBinaryPath)) {
    console.log(`[build:cpp] Notice: Compiler not detected or build failed, but existing binary found at ${targetBinaryPath}.`);
    if (!isWin) {
      try {
        execSync(`chmod +x "${targetBinaryPath}"`);
      } catch {}
    }
    process.exit(0);
  }

  console.error(`[build:cpp] ERROR: No compatible C++20 compiler found (CMake, g++, clang++, cl.exe).`);
  if (isWin) {
    console.error(`[build:cpp] Under Windows, please install MinGW-w64 (via MSYS2 / WinLibs) or Visual Studio C++ Build Tools.`);
  } else {
    console.error(`[build:cpp] Under Linux/macOS, please install g++ or clang++ (e.g., 'sudo apt-get install build-essential' or Xcode tools).`);
  }
  process.exit(1);
}

build();

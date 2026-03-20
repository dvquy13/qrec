// src/gpu-probe.ts
// One-shot GPU/CUDA detection. Result is memoized — safe to call from HTTP handlers.
// Linux only: checks for CUDA runtime libs + nvidia-smi output.
// macOS: Metal is handled automatically by node-llama-cpp; no probe needed.

import { existsSync, readFileSync, readdirSync } from "node:fs";

export interface LibProbeResult {
  found: boolean;
  path: string | null;
  soVersion: string | null; // e.g. "12" from libcudart.so.12
}

export interface GpuProbeResult {
  gpuDetected: boolean;
  gpuName: string | null;
  driverVersion: string | null;
  cudaDriverVersion: string | null;
  cudaRuntimeAvailable: boolean;
  vulkanAvailable: boolean;
  missingLibs: string[];
  /** Per-lib probe details for diagnostics */
  libProbes: Record<string, LibProbeResult>;
  /** Predicted backend based on library availability — mirrors node-llama-cpp's detection logic. */
  selectedBackend: "cuda" | "vulkan" | "cpu";
  /** Which node-llama-cpp prebuilt binary would be loaded (Linux only; null on macOS) */
  activeBinaryName: string | null;
  /** Package manager detected on this system */
  pkgManager: "apt" | "dnf" | "yum" | "pacman" | "unknown";
  /** Whether the NVIDIA CUDA apt repo is configured (apt systems only; null on non-apt) */
  cudaRepoConfigured: boolean | null;
  advice: string | null;
  /** Ordered fix steps when CUDA libs are missing */
  installSteps: string[] | null;
}

const CUDA_LIB_SEARCH_PATHS: string[] = [
  "/usr/lib",
  "/usr/lib64",
  "/usr/lib/x86_64-linux-gnu",
  "/usr/lib/aarch64-linux-gnu",
  "/usr/local/cuda/lib64",
  "/usr/local/cuda/targets/x86_64-linux/lib",
  "/usr/local/cuda/targets/aarch64-linux/lib",
  ...(process.env.LD_LIBRARY_PATH?.split(":").filter(Boolean) ?? []),
  ...(process.env.CUDA_PATH ? [`${process.env.CUDA_PATH}/lib64`] : []),
];

const REQUIRED_CUDA_LIBS = [
  { name: "libcudart",   variants: ["libcudart.so",   "libcudart.so.11",   "libcudart.so.12",   "libcudart.so.13"]   },
  { name: "libcublas",   variants: ["libcublas.so",   "libcublas.so.11",   "libcublas.so.12",   "libcublas.so.13"]   },
  { name: "libcublasLt", variants: ["libcublasLt.so", "libcublasLt.so.11", "libcublasLt.so.12", "libcublasLt.so.13"] },
];

function findLib(variants: string[], searchPaths: string[]): { path: string; soVersion: string | null } | null {
  for (const dir of searchPaths) {
    for (const variant of variants) {
      const p = `${dir}/${variant}`;
      if (existsSync(p)) {
        const m = variant.match(/\.so\.(\d+)/);
        return { path: p, soVersion: m?.[1] ?? null };
      }
    }
  }
  return null;
}

interface NvidiaSmiInfo { name: string; driver: string; cudaVersion: string }

function runNvidiaSmi(): NvidiaSmiInfo | null {
  try {
    const q = Bun.spawnSync(["nvidia-smi", "--query-gpu=name,driver_version", "--format=csv,noheader,nounits"]);
    if (q.exitCode !== 0 || !q.stdout) return null;
    const parts = q.stdout.toString("utf-8").trim().split(", ");
    if (parts.length < 2) return null;
    const name = parts[0].trim();
    const driver = parts[1].trim();

    // Parse CUDA version from nvidia-smi header (e.g. "CUDA Version: 12.8")
    const full = Bun.spawnSync(["nvidia-smi"]);
    const match = full.stdout?.toString("utf-8").match(/CUDA Version:\s*([\d.]+)/);
    return { name, driver, cudaVersion: match?.[1] ?? "unknown" };
  } catch {
    return null;
  }
}

function getOsRelease(): Record<string, string> {
  try {
    const content = readFileSync("/etc/os-release", "utf-8");
    const result: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const m = line.match(/^(\w+)="?([^"]*)"?$/);
      if (m) result[m[1]] = m[2];
    }
    return result;
  } catch { return {}; }
}

function detectPackageManager(): "apt" | "dnf" | "yum" | "pacman" | "unknown" {
  if (existsSync("/usr/bin/apt-get")) return "apt";
  if (existsSync("/usr/bin/dnf")) return "dnf";
  if (existsSync("/usr/bin/yum")) return "yum";
  if (existsSync("/usr/bin/pacman")) return "pacman";
  return "unknown";
}

function hasCudaAptRepo(): boolean {
  try {
    return readdirSync("/etc/apt/sources.list.d").some(f => f.startsWith("cuda") || f.includes("nvidia"));
  } catch { return false; }
}

/** Map .so version → which node-llama-cpp prebuilt binary would be loaded.
 *  linux-x64-cuda requires .so.13; linux-x64-cuda-ext accepts .so.12 or .so.11. */
function deriveActiveBinaryName(libProbes: Record<string, LibProbeResult>): string {
  const cudart = libProbes["libcudart"];
  const cublas = libProbes["libcublas"];
  if (!cudart?.found || !cublas?.found) return "linux-x64";
  if (cudart.soVersion === "13" && cublas.soVersion === "13") return "linux-x64-cuda";
  return "linux-x64-cuda-ext"; // .so.12 or .so.11 — fallback binary
}

function buildInstallSteps(
  gpu: NvidiaSmiInfo,
  pkgManager: "apt" | "dnf" | "yum" | "pacman" | "unknown",
  cudaRepoConfigured: boolean | null,
): string[] {
  const ver = gpu.cudaVersion !== "unknown"
    ? gpu.cudaVersion.split(".").slice(0, 2).join("-")
    : "12-8";
  const soVer = ver.split("-")[0]; // "12" from "12-8"

  const steps: string[] = [];
  if (pkgManager === "apt") {
    if (!cudaRepoConfigured) {
      const os = getOsRelease();
      const id = os.ID?.toLowerCase() ?? "ubuntu";
      const version = os.VERSION_ID?.replace(".", "") ?? "2204";
      steps.push(`wget https://developer.download.nvidia.com/compute/cuda/repos/${id}${version}/x86_64/cuda-keyring_1.1-1_all.deb`);
      steps.push(`sudo dpkg -i cuda-keyring_1.1-1_all.deb && sudo apt-get update`);
    }
    steps.push(`sudo apt install -y cuda-cudart-${ver} libcublas-${ver}`);
  } else if (pkgManager === "dnf" || pkgManager === "yum") {
    steps.push(`sudo ${pkgManager} install -y cuda-cudart-${ver} libcublas-${ver}`);
  } else if (pkgManager === "pacman") {
    steps.push(`sudo pacman -S cuda`);
  } else {
    steps.push(`# Install CUDA runtime libs from your package manager or the NVIDIA CUDA toolkit`);
    steps.push(`# Required: libcudart.so.${soVer}, libcublas.so.${soVer}, libcublasLt.so.${soVer}`);
  }
  steps.push(`qrec teardown && qrec serve --daemon`);
  return steps;
}

let _cached: GpuProbeResult | null = null;

export function probeGpu(): GpuProbeResult {
  if (_cached) return _cached;

  // macOS: Metal is selected automatically by node-llama-cpp; CUDA probe is irrelevant.
  if (process.platform !== "linux") {
    _cached = {
      gpuDetected: false, gpuName: null, driverVersion: null,
      cudaDriverVersion: null, cudaRuntimeAvailable: false,
      vulkanAvailable: false, missingLibs: [], libProbes: {},
      selectedBackend: "cpu", activeBinaryName: null,
      pkgManager: "unknown", cudaRepoConfigured: null,
      advice: null, installSteps: null,
    };
    return _cached;
  }

  const gpu = runNvidiaSmi();

  const libProbes: Record<string, LibProbeResult> = {};
  const missingLibs: string[] = [];
  for (const lib of REQUIRED_CUDA_LIBS) {
    const found = findLib(lib.variants, CUDA_LIB_SEARCH_PATHS);
    libProbes[lib.name] = { found: found !== null, path: found?.path ?? null, soVersion: found?.soVersion ?? null };
    if (!found) missingLibs.push(lib.name);
  }

  const vulkanResult = findLib(["libvulkan.so", "libvulkan.so.1"], CUDA_LIB_SEARCH_PATHS);
  const cudaRuntimeAvailable = gpu !== null && missingLibs.length === 0;
  const vulkanAvailable = vulkanResult !== null;
  const selectedBackend: "cuda" | "vulkan" | "cpu" =
    cudaRuntimeAvailable ? "cuda" : vulkanAvailable ? "vulkan" : "cpu";

  const activeBinaryName = cudaRuntimeAvailable ? deriveActiveBinaryName(libProbes) : "linux-x64";

  const pkgManager = detectPackageManager();
  const cudaRepoConfigured = pkgManager === "apt" ? hasCudaAptRepo() : null;

  let advice: string | null = null;
  let installSteps: string[] | null = null;
  if (gpu && !cudaRuntimeAvailable) {
    advice = `GPU detected (${gpu.name}) but CUDA runtime libs missing: ${missingLibs.join(", ")}.`;
    installSteps = buildInstallSteps(gpu, pkgManager, cudaRepoConfigured);
  }

  _cached = {
    gpuDetected: gpu !== null,
    gpuName: gpu?.name ?? null,
    driverVersion: gpu?.driver ?? null,
    cudaDriverVersion: gpu?.cudaVersion ?? null,
    cudaRuntimeAvailable,
    vulkanAvailable,
    missingLibs,
    libProbes,
    selectedBackend,
    activeBinaryName,
    pkgManager,
    cudaRepoConfigured,
    advice,
    installSteps,
  };
  return _cached;
}

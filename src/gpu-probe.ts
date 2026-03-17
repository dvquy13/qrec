// src/gpu-probe.ts
// One-shot GPU/CUDA detection. Result is memoized — safe to call from HTTP handlers.
// Linux only: checks for CUDA runtime libs + nvidia-smi output.
// macOS: Metal is handled automatically by node-llama-cpp; no probe needed.

import { existsSync } from "node:fs";

export interface GpuProbeResult {
  gpuDetected: boolean;
  gpuName: string | null;
  driverVersion: string | null;
  cudaDriverVersion: string | null;
  cudaRuntimeAvailable: boolean;
  vulkanAvailable: boolean;
  missingLibs: string[];
  /** Predicted backend based on library availability — mirrors node-llama-cpp's detection logic. */
  selectedBackend: "cuda" | "vulkan" | "cpu";
  advice: string | null;
}

const CUDA_LIB_SEARCH_PATHS: string[] = [
  "/usr/lib",
  "/usr/lib64",
  "/usr/lib/x86_64-linux-gnu",
  "/usr/lib/aarch64-linux-gnu",
  "/usr/local/cuda/lib64",
  ...(process.env.LD_LIBRARY_PATH?.split(":").filter(Boolean) ?? []),
  ...(process.env.CUDA_PATH ? [`${process.env.CUDA_PATH}/lib64`] : []),
];

const REQUIRED_CUDA_LIBS = [
  { name: "libcudart",   variants: ["libcudart.so",   "libcudart.so.11",   "libcudart.so.12",   "libcudart.so.13"]   },
  { name: "libcublas",   variants: ["libcublas.so",   "libcublas.so.11",   "libcublas.so.12",   "libcublas.so.13"]   },
  { name: "libcublasLt", variants: ["libcublasLt.so", "libcublasLt.so.11", "libcublasLt.so.12", "libcublasLt.so.13"] },
];

function findLib(variants: string[], searchPaths: string[]): boolean {
  for (const dir of searchPaths) {
    for (const variant of variants) {
      if (existsSync(`${dir}/${variant}`)) return true;
    }
  }
  return false;
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

let _cached: GpuProbeResult | null = null;

export function probeGpu(): GpuProbeResult {
  if (_cached) return _cached;

  // macOS: Metal is selected automatically by node-llama-cpp; CUDA probe is irrelevant.
  if (process.platform !== "linux") {
    _cached = {
      gpuDetected: false, gpuName: null, driverVersion: null,
      cudaDriverVersion: null, cudaRuntimeAvailable: false,
      vulkanAvailable: false, missingLibs: [], selectedBackend: "cpu", advice: null,
    };
    return _cached;
  }

  const gpu = runNvidiaSmi();
  const missingLibs: string[] = [];
  for (const lib of REQUIRED_CUDA_LIBS) {
    if (!findLib(lib.variants, CUDA_LIB_SEARCH_PATHS)) missingLibs.push(lib.name);
  }

  const cudaRuntimeAvailable = gpu !== null && missingLibs.length === 0;
  const vulkanAvailable = findLib(["libvulkan.so", "libvulkan.so.1"], CUDA_LIB_SEARCH_PATHS);
  const selectedBackend: "cuda" | "vulkan" | "cpu" =
    cudaRuntimeAvailable ? "cuda" : vulkanAvailable ? "vulkan" : "cpu";

  let advice: string | null = null;
  if (gpu && !cudaRuntimeAvailable) {
    const ver = gpu.cudaVersion !== "unknown" ? gpu.cudaVersion.split(".").slice(0, 2).join("-") : "12";
    advice =
      `GPU detected (${gpu.name}) but CUDA runtime libs missing: ${missingLibs.join(", ")}. ` +
      `Install with: apt install -y cuda-toolkit-${ver}   OR   apt install -y libcudart12 libcublas12. ` +
      `Then restart qrec.`;
  }

  _cached = {
    gpuDetected: gpu !== null,
    gpuName: gpu?.name ?? null,
    driverVersion: gpu?.driver ?? null,
    cudaDriverVersion: gpu?.cudaVersion ?? null,
    cudaRuntimeAvailable,
    vulkanAvailable,
    missingLibs,
    selectedBackend,
    advice,
  };
  return _cached;
}

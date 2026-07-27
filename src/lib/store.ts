// Server-side dataset store. Loads once, caches in memory + on disk, and refreshes
// when stale. Falls back to the sample dataset when no URA access key is present.

import "server-only";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { Dataset } from "./types";
import { fetchDataset } from "./ura";
import { buildSampleDataset } from "./sampleData";

const CACHE_DIR = process.env.URA_CACHE_DIR || path.join(os.tmpdir(), "sg-property-cache");
const CACHE_FILE = path.join(CACHE_DIR, "dataset.json");
const MAX_AGE_MS = 1000 * 60 * 60 * 12; // refresh at most twice a day

let memory: Dataset | null = null;
let inflight: Promise<Dataset> | null = null;

async function readDisk(): Promise<Dataset | null> {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf8");
    return JSON.parse(raw) as Dataset;
  } catch {
    return null;
  }
}

async function writeDisk(ds: Dataset): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(ds), "utf8");
  } catch {
    // Non-fatal: caching to disk is a nicety, not a requirement.
  }
}

function isStale(ds: Dataset): boolean {
  return Date.now() - new Date(ds.fetchedAt).getTime() > MAX_AGE_MS;
}

async function load(force = false): Promise<Dataset> {
  const accessKey = process.env.URA_ACCESS_KEY;

  if (!force) {
    if (memory && !isStale(memory)) return memory;
    const disk = await readDisk();
    if (disk && !isStale(disk)) {
      memory = disk;
      return disk;
    }
  }

  if (!accessKey) {
    // No key configured — serve the clearly-labelled sample dataset.
    memory = buildSampleDataset();
    return memory;
  }

  try {
    const ds = await fetchDataset(accessKey);
    memory = ds;
    await writeDisk(ds);
    return ds;
  } catch (err) {
    // If a refresh fails, prefer any cached real data before falling back.
    const disk = await readDisk();
    if (disk) {
      memory = disk;
      return disk;
    }
    const sample = buildSampleDataset();
    (sample as Dataset & { error?: string }).error =
      err instanceof Error ? err.message : "URA fetch failed";
    memory = sample;
    return sample;
  }
}

export async function getDataset(): Promise<Dataset> {
  if (memory && !isStale(memory)) return memory;
  if (!inflight) {
    inflight = load().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

export async function refreshDataset(): Promise<Dataset> {
  memory = null;
  return load(true);
}

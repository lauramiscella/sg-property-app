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

// ---- Vercel Blob persistence (optional) -------------------------------------
// If a Blob store is connected (BLOB_READ_WRITE_TOKEN present), the dataset is
// also saved there. Cold serverless starts then load from Blob in well under a
// second instead of blocking the first visitor on a full URA pull — and the
// accumulating archive survives redeploys. Without the token these are no-ops.
const BLOB_KEY = "sg-property/dataset.json";
const hasBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

async function readBlob(): Promise<Dataset | null> {
  if (!hasBlob()) return null;
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: BLOB_KEY, limit: 1 });
    if (!blobs.length) return null;
    const res = await fetch(blobs[0].url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Dataset;
  } catch {
    return null;
  }
}

async function writeBlob(ds: Dataset): Promise<void> {
  if (!hasBlob()) return;
  try {
    const { put } = await import("@vercel/blob");
    await put(BLOB_KEY, JSON.stringify(ds), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } catch {
    // Non-fatal — Blob is a cache layer, not the source of truth.
  }
}

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
    const blob = await readBlob();
    if (blob && !isStale(blob)) {
      memory = blob;
      await writeDisk(blob);
      return blob;
    }
  }

  if (!accessKey) {
    // No key configured — serve the clearly-labelled sample dataset.
    memory = buildSampleDataset();
    return memory;
  }

  try {
    const fresh = await fetchDataset(accessKey);
    // ACCUMULATE: URA only serves ~5 years back. Merge with any previously
    // cached data so months URA drops off are retained and history grows.
    const prior = (await readDisk()) ?? (await readBlob());
    const ds = prior && prior.source === "URA" ? mergeDatasets(prior, fresh) : fresh;
    memory = ds;
    await writeDisk(ds);
    await writeBlob(ds);
    return ds;
  } catch (err) {
    // If a refresh fails, prefer any cached real data before falling back.
    const cached = (await readDisk()) ?? (await readBlob());
    if (cached) {
      memory = cached;
      return cached;
    }
    const sample = buildSampleDataset();
    (sample as Dataset & { error?: string }).error =
      err instanceof Error ? err.message : "URA fetch failed";
    memory = sample;
    return sample;
  }
}

export async function getDataset(): Promise<Dataset> {
  // Fresh in memory — instant.
  if (memory && !isStale(memory)) return memory;

  // Not in memory yet (cold start): pull from the cheap caches first.
  if (!memory) {
    const cached = (await readDisk()) ?? (await readBlob());
    if (cached) memory = cached;
  }

  // SERVE-STALE-INSTANTLY: if we have ANY real data, return it now and let a
  // background refresh bring it up to date. A visitor never waits on URA.
  if (memory) {
    if (isStale(memory) && !inflight) {
      inflight = load(true)
        .catch(() => memory as Dataset)
        .finally(() => {
          inflight = null;
        });
    }
    return memory;
  }

  // Truly nothing cached anywhere (first boot ever) — block on the first pull.
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

// Merge a fresh URA pull into the accumulated history. Caveats have no ID, so
// dedupe on a composite of the fields that uniquely describe a lodged caveat.
function mergeDatasets(prior: Dataset, fresh: Dataset): Dataset {
  const txnKey = (t: Dataset["txns"][number]) =>
    `${t.project}|${t.contractDate}|${t.price}|${t.areaSqm}|${t.floorRange ?? ""}|${t.saleType}`;
  const rentKey = (r: Dataset["rentals"][number]) =>
    `${r.project}|${r.leaseDate}|${r.rent}|${r.areaSqftMid ?? ""}|${r.bedrooms ?? ""}`;

  const txnMap = new Map(prior.txns.map((t) => [txnKey(t), t]));
  for (const t of fresh.txns) txnMap.set(txnKey(t), t); // fresh wins on collision
  const rentMap = new Map(prior.rentals.map((r) => [rentKey(r), r]));
  for (const r of fresh.rentals) rentMap.set(rentKey(r), r);

  // Reassign ids — each pull numbers from 0, so merged sets would collide.
  const txns = Array.from(txnMap.values()).map((t, i) => ({ ...t, id: `t${i}` }));
  const rentals = Array.from(rentMap.values()).map((r, i) => ({ ...r, id: `r${i}` }));
  const months = txns.map((t) => t.month).sort();
  return {
    txns,
    rentals,
    source: "URA",
    fetchedAt: fresh.fetchedAt,
    transactionMonths: months.length ? { min: months[0], max: months[months.length - 1] } : null,
    rentalQuarters: Array.from(new Set(rentals.map((r) => r.quarter))).sort(),
  };
}

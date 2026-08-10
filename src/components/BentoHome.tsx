"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform, useMotionTemplate } from "framer-motion";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { dShort, fmtNum } from "@/lib/format";

export interface GadgetData {
  access: "full" | "trial";
  latestQuarter: string | null;
  medianPsf: number | null;
  yoyPct: number | null;
  spark: { period: string; psf: number | null }[];
  dealsLatestMonth: number;
  latestMonth: string | null;
  txnCount: number;
  hotDistrict: { district: string; pct: number } | null;
  fhPremiumPct: number | null;
  launchPremiumPct: number | null;
}

// Animated count-up number (framer-motion spring)
function Ticker({ value, prefix = "", suffix = "", decimals = 0 }: { value: number; prefix?: string; suffix?: string; decimals?: number }) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 60, damping: 18 });
  const text = useTransform(spring, (v) =>
    `${prefix}${v.toLocaleString("en-SG", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`
  );
  useEffect(() => {
    mv.set(value);
  }, [value, mv]);
  return <motion.span>{text}</motion.span>;
}

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055 } },
};
const tileVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 260, damping: 24 } },
};

// 3D tilt tile: rotates in perspective toward the cursor, with a light glare
// that tracks it, and its content floating above the surface (translateZ).
function Tile({
  onClick,
  color,
  className = "",
  locked = false,
  children,
}: {
  onClick: () => void;
  color: string;
  className?: string;
  locked?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const rxRaw = useMotionValue(0);
  const ryRaw = useMotionValue(0);
  const rx = useSpring(rxRaw, { stiffness: 220, damping: 18 });
  const ry = useSpring(ryRaw, { stiffness: 220, damping: 18 });
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);
  const glare = useMotionTemplate`radial-gradient(260px circle at ${gx}% ${gy}%, rgba(255,252,240,0.55), rgba(255,252,240,0) 62%)`;

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width; // 0..1
    const py = (e.clientY - r.top) / r.height;
    ryRaw.set((px - 0.5) * 14); // rotateY: left/right
    rxRaw.set(-(py - 0.5) * 12); // rotateX: up/down
    gx.set(px * 100);
    gy.set(py * 100);
  };
  const onLeave = () => {
    rxRaw.set(0);
    ryRaw.set(0);
    gx.set(50);
    gy.set(50);
  };

  return (
    <motion.button
      ref={ref}
      variants={tileVariants}
      whileHover={{ scale: 1.03, zIndex: 5 }}
      whileTap={{ scale: 0.97 }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={onClick}
      className={`group relative flex flex-col justify-between rounded-2xl border p-4 text-left ${className}`}
      style={{
        rotateX: rx,
        rotateY: ry,
        transformStyle: "preserve-3d",
        background: locked
          ? "color-mix(in srgb, var(--color-card-2) 55%, rgba(255,253,248,0.55))"
          : `linear-gradient(155deg, color-mix(in srgb, ${color} 16%, rgba(255,253,248,0.72)), color-mix(in srgb, ${color} 5%, rgba(255,253,248,0.6)))`,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        borderColor: `color-mix(in srgb, ${color} ${locked ? 18 : 35}%, transparent)`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.85), 0 2px 4px -2px color-mix(in srgb, ${color} 30%, transparent), 0 18px 36px -18px color-mix(in srgb, ${color} ${locked ? 30 : 60}%, transparent)`,
      }}
    >
      {/* cursor-tracked glare */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: glare }}
      />
      {/* content floats 26px above the card plane */}
      <div
        className="flex min-h-0 flex-1 flex-col justify-between"
        style={{ transform: "translateZ(26px)", transformStyle: "preserve-3d" }}
      >
        {children}
      </div>
    </motion.button>
  );
}

// Slow-drifting warm gradient blobs behind the glass tiles.
function Blobs() {
  const blob = "pointer-events-none absolute rounded-full blur-3xl";
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden rounded-3xl">
      <motion.div
        className={blob}
        style={{ width: 380, height: 380, left: "-6%", top: "-12%", background: "color-mix(in srgb, var(--color-amber) 26%, transparent)" }}
        animate={{ x: [0, 50, -25, 0], y: [0, 30, -18, 0], scale: [1, 1.12, 0.96, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className={blob}
        style={{ width: 330, height: 330, right: "-4%", top: "8%", background: "color-mix(in srgb, var(--color-plum) 22%, transparent)" }}
        animate={{ x: [0, -45, 25, 0], y: [0, 35, -22, 0], scale: [1, 0.94, 1.1, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className={blob}
        style={{ width: 360, height: 360, left: "28%", bottom: "-16%", background: "color-mix(in srgb, var(--color-emerald) 20%, transparent)" }}
        animate={{ x: [0, 40, -35, 0], y: [0, -28, 16, 0], scale: [1, 1.08, 0.95, 1] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className={blob}
        style={{ width: 280, height: 280, right: "22%", bottom: "-8%", background: "color-mix(in srgb, var(--color-gold) 26%, transparent)" }}
        animate={{ x: [0, -30, 30, 0], y: [0, 22, -20, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

function TileLabel({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color }}>
      {children}
    </div>
  );
}

function LockedBody({ label }: { label: string }) {
  return (
    <div className="mt-1">
      <div className="text-[15px] font-bold text-ink-soft">🔒 {label}</div>
      <div className="mt-0.5 text-[11px] text-muted">Full version</div>
    </div>
  );
}

// Shown while the numbers are still on their way. Must never look like a lock —
// a slow first load used to render the locked state by mistake.
function LoadingBody() {
  return (
    <div className="mt-1">
      <div className="h-[21px] w-24 animate-pulse rounded-md bg-line/70" />
      <div className="mt-1.5 h-[11px] w-32 animate-pulse rounded bg-line/50" />
    </div>
  );
}

// Loaded, not locked, but the slice genuinely has too few caveats to compute.
function ThinDataBody({ label }: { label: string }) {
  return (
    <div className="mt-1">
      <div className="text-[15px] font-bold text-ink-soft">—</div>
      <div className="mt-0.5 text-[11px] text-muted">{label}</div>
    </div>
  );
}

function OpenHint({ color }: { color: string }) {
  return (
    <div className="mt-2 text-[11px] font-semibold" style={{ color }}>
      Open <span className="inline-block transition group-hover:translate-x-0.5">→</span>
    </div>
  );
}

export default function BentoHome({
  trial,
  onOpen,
}: {
  trial: boolean;
  onOpen: (view: string) => void;
}) {
  const [g, setG] = useState<GadgetData | null>(null);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    let cancelled = false;
    // One retry: a cold serverless start can drop the very first call, and a
    // silent failure used to leave the tiles stuck looking locked until the
    // visitor refreshed the page.
    const load = async (attempt = 0): Promise<void> => {
      try {
        const res = await fetch("/api/gadgets");
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        if (!cancelled) setG(json);
      } catch {
        if (attempt < 1 && !cancelled) {
          setTimeout(() => load(attempt + 1), 1500);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const C = {
    amber: "var(--color-amber)",
    emerald: "var(--color-emerald)",
    plum: "var(--color-plum)",
    gold: "var(--color-gold)",
    clay: "var(--color-clay)",
    brick: "var(--color-brick)",
    sage: "var(--color-sage)",
  };

  return (
    <div className="relative">
      <Blobs />
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="relative grid grid-cols-2 gap-3.5 md:grid-cols-4"
        style={{ perspective: 1100 }}
      >
      {/* Market pulse — 2x2 hero */}
      <Tile onClick={() => onOpen("psf")} color={C.amber} className="col-span-2 row-span-2 min-h-[236px]">
        <div>
          <TileLabel color={C.amber}>Market pulse{g?.latestQuarter ? ` · ${g.latestQuarter}` : ""}</TileLabel>
          <div className="mt-2 text-[34px] font-bold leading-none tracking-tight text-ink">
            {g?.medianPsf != null ? <Ticker value={g.medianPsf} prefix="$" /> : "—"}
            <span className="ml-1.5 text-[13px] font-semibold text-muted">psf median</span>
          </div>
          {g?.yoyPct != null && (
            <span
              className="mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold"
              style={{
                color: g.yoyPct >= 0 ? C.emerald : C.brick,
                background: `color-mix(in srgb, ${g.yoyPct >= 0 ? C.emerald : C.brick} 12%, transparent)`,
              }}
            >
              {g.yoyPct >= 0 ? "▲" : "▼"} {Math.abs(g.yoyPct)}% vs a year ago
            </span>
          )}
        </div>
        {g && g.spark.length > 1 && (
          <div className="mt-3 h-[74px] w-full">
            <ResponsiveContainer>
              <LineChart data={g.spark} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <YAxis hide domain={["dataMin", "dataMax"]} />
                <Line dataKey="psf" stroke="#b0743a" strokeWidth={2.4} dot={false} isAnimationActive />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11.5px] text-muted">
            {g ? <><b className="text-ink-soft">{fmtNum(g.dealsLatestMonth)}</b> deals lodged in {g.latestMonth}</> : "Loading…"}
          </span>
          <OpenHint color={C.amber} />
        </div>
      </Tile>

      {/* Hottest district */}
      <Tile onClick={() => onOpen("momentum")} color={C.emerald} locked={trial}>
        <TileLabel color={C.emerald}>Hottest district</TileLabel>
        {trial ? (
          <LockedBody label="See which district leads" />
        ) : !g ? (
          <LoadingBody />
        ) : !g.hotDistrict ? (
          <ThinDataBody label="Not enough recent caveats" />
        ) : (
          <div className="mt-1">
            <div className="text-[21px] font-bold leading-tight text-ink">{dShort(g.hotDistrict.district)}</div>
            <div className="mt-0.5 text-[12px] font-semibold" style={{ color: C.emerald }}>
              ▲ <Ticker value={g.hotDistrict.pct} decimals={1} suffix="%" /> PSF vs prior year
            </div>
          </div>
        )}
        <OpenHint color={C.emerald} />
      </Tile>

      {/* Freehold premium */}
      <Tile onClick={() => onOpen("tenure")} color={C.clay} locked={trial}>
        <TileLabel color={C.clay}>Freehold premium</TileLabel>
        {trial ? (
          <LockedBody label="What freehold really costs" />
        ) : !g ? (
          <LoadingBody />
        ) : g.fhPremiumPct == null ? (
          <ThinDataBody label="Not enough recent caveats" />
        ) : (
          <div className="mt-1">
            <div className="text-[21px] font-bold leading-tight text-ink">
              <Ticker value={g.fhPremiumPct} decimals={1} suffix="%" />
            </div>
            <div className="mt-0.5 text-[11px] text-muted">over leasehold, latest quarter</div>
          </div>
        )}
        <OpenHint color={C.clay} />
      </Tile>

      {/* Launch premium */}
      <Tile onClick={() => onOpen("premium")} color={C.plum} locked={trial}>
        <TileLabel color={C.plum}>New launch premium</TileLabel>
        {trial ? (
          <LockedBody label="New sale vs resale gap" />
        ) : !g ? (
          <LoadingBody />
        ) : g.launchPremiumPct == null ? (
          <ThinDataBody label="Not enough recent caveats" />
        ) : (
          <div className="mt-1">
            <div className="text-[21px] font-bold leading-tight text-ink">
              <Ticker value={g.launchPremiumPct} decimals={1} suffix="%" />
            </div>
            <div className="mt-0.5 text-[11px] text-muted">above resale PSF, latest quarter</div>
          </div>
        )}
        <OpenHint color={C.plum} />
      </Tile>

      {/* Past transactions */}
      <Tile onClick={() => onOpen("comps")} color={C.sage}>
        <TileLabel color={C.sage}>The receipts</TileLabel>
        <div className="mt-1">
          <div className="text-[21px] font-bold leading-tight text-ink">
            {g ? <Ticker value={g.txnCount} /> : "—"}
          </div>
          <div className="mt-0.5 text-[11px] text-muted">caveats on record{trial ? " · preview shows 5" : ""}</div>
        </div>
        <OpenHint color={C.sage} />
      </Tile>

      {/* Budget explorer — wide */}
      <Tile onClick={() => onOpen("budget")} color={C.gold} className="col-span-2">
        <TileLabel color={C.gold}>Budget explorer</TileLabel>
        <div className="mt-1 text-[16px] font-bold leading-snug text-ink">What can your budget actually buy?</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {["$1M–$1.5M", "$1.5M–$2M", "$2M–$2.5M"].map((c) => (
            <span key={c} className="rounded-full border border-line bg-card px-2 py-0.5 text-[11px] font-medium text-ink-soft">
              {c}
            </span>
          ))}
        </div>
        <OpenHint color={C.gold} />
      </Tile>

      {/* Price check */}
      <Tile onClick={() => onOpen("value")} color={C.plum} locked={trial}>
        <TileLabel color={C.plum}>Price check</TileLabel>
        {trial ? (
          <LockedBody label="Is that asking price fair?" />
        ) : (
          <div className="mt-1 text-[14px] font-bold leading-snug text-ink">Is that asking price fair?</div>
        )}
        <OpenHint color={C.plum} />
      </Tile>

      {/* Sell speed */}
      <Tile onClick={() => onOpen("absorption")} color={C.brick} locked={trial}>
        <TileLabel color={C.brick}>Sell speed</TileLabel>
        {trial ? (
          <LockedBody label="How fast will it sell?" />
        ) : (
          <div className="mt-1 text-[14px] font-bold leading-snug text-ink">How fast will your unit sell?</div>
        )}
        <OpenHint color={C.brick} />
      </Tile>

      {/* Rental yield */}
      <Tile onClick={() => onOpen("yield")} color={C.emerald} locked={trial}>
        <TileLabel color={C.emerald}>Rental yield</TileLabel>
        {trial ? <LockedBody label="Rent vs price, by area" /> : (
          <div className="mt-1 text-[14px] font-bold leading-snug text-ink">What does rent earn here?</div>
        )}
        <OpenHint color={C.emerald} />
      </Tile>

      {/* Performance & compare */}
      <Tile onClick={() => onOpen("appreciation")} color={C.amber} locked={trial}>
        <TileLabel color={C.amber}>Performance</TileLabel>
        {trial ? <LockedBody label="Project growth, compared" /> : (
          <div className="mt-1 text-[14px] font-bold leading-snug text-ink">Which projects actually grew?</div>
        )}
        <OpenHint color={C.amber} />
      </Tile>

      {/* Size bands */}
      <Tile onClick={() => onOpen("sizebands")} color={C.gold} locked={trial}>
        <TileLabel color={C.gold}>Size bands</TileLabel>
        {trial ? <LockedBody label="Growth by unit size" /> : (
          <div className="mt-1 text-[14px] font-bold leading-snug text-ink">Do bigger units grow faster?</div>
        )}
        <OpenHint color={C.gold} />
      </Tile>

      {/* Calculators */}
      <Tile onClick={() => onOpen("calc")} color={C.clay}>
        <TileLabel color={C.clay}>Calculators</TileLabel>
        <div className="mt-1 text-[14px] font-bold leading-snug text-ink">Stamp duty, loans, affordability</div>
        <OpenHint color={C.clay} />
      </Tile>
      </motion.div>
    </div>
  );
}

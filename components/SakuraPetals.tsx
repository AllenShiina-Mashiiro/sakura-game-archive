"use client";

import { useEffect, useRef } from "react";

/**
 * 樱花飘落：三层景深（远景微虚 / 中景清晰 / 近景大虚化）+ 光斑 + 鼠标扰动
 * 纯 Canvas，无依赖。用法：app/layout.tsx 的 <body> 里放 <SakuraPetals />
 */

type SakuraConfig = { count: number; opacity: number; wind: number; motes: boolean };
type Layer = "far" | "mid" | "near";
type LayerDef = { blur: number; len: [number, number]; vy: [number, number]; alpha: [number, number]; sway: number; depth: number };
type Sprite = { cv: HTMLCanvasElement; size: number };
type Petal = {
  layer: Layer; blossom: boolean; sprite: Sprite; scale: number;
  x: number; y: number; vx: number; vy: number; rot: number; vr: number;
  flip: number; vflip: number; sway: number; swaySpeed: number; swayAmp: number;
  depth: number; alpha: number; pvx: number; pvy: number;
};
type Mote = { x: number; y: number; r: number; vx: number; vy: number; phase: number; tw: number; alpha: number };
const LAYER_KEYS: Layer[] = ["far", "mid", "near"];

function startSakura(canvas: HTMLCanvasElement, options?: Partial<SakuraConfig>) {
  const maybeCtx = canvas.getContext("2d");
  if (!maybeCtx) return null;
  const ctx = maybeCtx;
  const cfg: SakuraConfig = Object.assign({ count: 40, opacity: 1, wind: 1, motes: true }, options || {});
  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  const pick = <T,>(arr: T[]): T => arr[(Math.random() * arr.length) | 0];
  const BASE = 64;
  const HUES = [338, 346, 354];
  const probe = document.createElement("canvas").getContext("2d");
  const canFilter = !!probe && typeof probe.filter === "string";

  // ---------- 预渲染贴图 ----------
  function petalPath(c: CanvasRenderingContext2D, s: number) {
    c.beginPath();
    c.moveTo(0, s);
    c.bezierCurveTo(s, s * 0.45, s * 0.82, -s * 0.62, s * 0.22, -s * 0.98);
    c.quadraticCurveTo(s * 0.08, -s * 0.86, 0, -s * 0.72);
    c.quadraticCurveTo(-s * 0.08, -s * 0.86, -s * 0.22, -s * 0.98);
    c.bezierCurveTo(-s * 0.82, -s * 0.62, -s, s * 0.45, 0, s);
    c.closePath();
  }

  function petalFill(c: CanvasRenderingContext2D, hue: number, s: number) {
    const g = c.createRadialGradient(0, s * 0.7, 1, 0, 0, s * 1.15);
    g.addColorStop(0, `hsl(${hue},70%,98%)`);
    g.addColorStop(0.5, `hsl(${hue},72%,91%)`);
    g.addColorStop(1, `hsl(${hue},78%,80%)`);
    return g;
  }

  function newCanvas(size: number) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = size;
    const c = cv.getContext("2d")!;
    c.translate(size / 2, size / 2);
    return { cv, c };
  }

  function makePetalSprite(hue: number, blur: number): Sprite {
    const pad = Math.ceil(blur * 2.5) + 12;
    const size = BASE + pad * 2;
    const { cv, c } = newCanvas(size);
    const s = BASE / 2;

    if (blur > 0) {
      if (canFilter) {
        c.filter = `blur(${blur}px)`;
        c.fillStyle = petalFill(c, hue, s);
        petalPath(c, s); c.fill();
      } else {
        // 不支持 filter 的浏览器用阴影模拟虚化
        c.translate(-4000, 0);
        c.shadowOffsetX = 4000;
        c.shadowBlur = blur * 2;
        c.shadowColor = `hsl(${hue},75%,88%)`;
        c.fillStyle = "#fff";
        petalPath(c, s); c.fill();
      }
      return { cv, size };
    }

    // 清晰花瓣：柔光 + 光泽 + 叶脉
    c.shadowColor = `hsla(${hue},90%,85%,0.55)`;
    c.shadowBlur = 8;
    c.fillStyle = petalFill(c, hue, s);
    petalPath(c, s); c.fill();
    c.shadowBlur = 0;

    c.save();
    petalPath(c, s); c.clip();
    const sheen = c.createLinearGradient(-s, -s * 0.3, s, s * 0.3);
    sheen.addColorStop(0, "rgba(255,255,255,0)");
    sheen.addColorStop(0.38, "rgba(255,255,255,0.38)");
    sheen.addColorStop(0.62, "rgba(255,255,255,0)");
    c.fillStyle = sheen;
    c.fillRect(-s, -s, s * 2, s * 2);
    c.strokeStyle = `hsla(${hue},60%,72%,0.35)`;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(0, s * 0.9);
    c.quadraticCurveTo(s * 0.06, 0, 0, -s * 0.6);
    c.stroke();
    c.restore();
    return { cv, size };
  }

  function makeBlossomSprite(hue: number): Sprite {
    const size = 112;
    const { cv, c } = newCanvas(size);
    const s2 = 18;
    c.shadowColor = `hsla(${hue},90%,85%,0.5)`;
    c.shadowBlur = 8;
    for (let i = 0; i < 5; i++) {
      c.save();
      c.rotate((i * Math.PI * 2) / 5);
      c.translate(0, -s2);
      c.fillStyle = petalFill(c, hue, s2);
      petalPath(c, s2); c.fill();
      c.restore();
    }
    c.shadowBlur = 0;
    const core = c.createRadialGradient(0, 0, 0, 0, 0, 9);
    core.addColorStop(0, `hsl(${hue},80%,70%)`);
    core.addColorStop(1, `hsla(${hue},80%,85%,0)`);
    c.fillStyle = core;
    c.beginPath(); c.arc(0, 0, 9, 0, Math.PI * 2); c.fill();
    c.strokeStyle = `hsla(${hue},70%,75%,0.8)`;
    c.fillStyle = "hsl(45,90%,78%)";
    c.lineWidth = 0.8;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.2;
      const r = 7 + (i % 3) * 1.5;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * r, Math.sin(a) * r); c.stroke();
      c.beginPath(); c.arc(Math.cos(a) * r, Math.sin(a) * r, 1.2, 0, Math.PI * 2); c.fill();
    }
    return { cv, size };
  }

  function makeMoteSprite(): Sprite {
    const size = 64;
    const { cv, c } = newCanvas(size);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 32);
    g.addColorStop(0, "rgba(255,240,248,0.9)");
    g.addColorStop(0.25, "rgba(255,200,230,0.35)");
    g.addColorStop(1, "rgba(255,180,220,0)");
    c.fillStyle = g;
    c.fillRect(-32, -32, 64, 64);
    return { cv, size };
  }

  // 三层景深：远景小而微虚，中景清晰，近景大而强虚化
  const LAYERS: Record<Layer, LayerDef> = {
    far:  { blur: 7,  len: [7, 11],  vy: [0.3, 0.55], alpha: [0.35, 0.55], sway: 0.35, depth: 0.5 },
    mid:  { blur: 0,  len: [13, 21], vy: [0.6, 1.1],  alpha: [0.75, 0.95], sway: 0.6,  depth: 1 },
    near: { blur: 11, len: [42, 64], vy: [1.5, 2.3],  alpha: [0.22, 0.38], sway: 1.0,  depth: 1.8 },
  };
  const sprites = {} as Record<Layer, Sprite[]>;
  for (const k of LAYER_KEYS) sprites[k] = HUES.map((h) => makePetalSprite(h, LAYERS[k].blur));
  const blossoms = HUES.map(makeBlossomSprite);
  const moteSprite = makeMoteSprite();

  // ---------- 粒子 ----------
  let w = 0, h = 0, dpr = 1;

  function spawn(layer: Layer, initial: boolean): Petal {
    const L = LAYERS[layer];
    const blossom = layer === "mid" && Math.random() < 0.08;
    const len = blossom ? rand(22, 30) : rand(L.len[0], L.len[1]);
    return {
      layer, blossom,
      sprite: blossom ? pick(blossoms) : pick(sprites[layer]),
      scale: len / (blossom ? 72 : BASE),
      x: rand(-60, w + 60),
      y: initial ? rand(-h * 0.2, h) : rand(-120, -30),
      vx: rand(-0.15, 0.3),
      vy: rand(L.vy[0], L.vy[1]) * (blossom ? 0.8 : 1),
      rot: rand(0, Math.PI * 2),
      vr: rand(-0.015, 0.015) * (blossom ? 0.5 : 1),
      flip: rand(0, Math.PI * 2),
      vflip: blossom ? rand(0.005, 0.012) : rand(0.015, 0.045),
      sway: rand(0, Math.PI * 2),
      swaySpeed: rand(0.008, 0.022),
      swayAmp: L.sway,
      depth: L.depth,
      alpha: rand(L.alpha[0], L.alpha[1]),
      pvx: 0, pvy: 0,
    };
  }

  function makeMote(initial: boolean): Mote {
    return {
      x: rand(0, w), y: initial ? rand(0, h) : h + 30,
      r: rand(10, 28), vx: rand(-0.1, 0.1), vy: rand(-0.16, -0.04),
      phase: rand(0, Math.PI * 2), tw: rand(0.01, 0.03), alpha: rand(0.15, 0.4),
    };
  }

  const pools: Record<Layer, Petal[]> = { far: [], mid: [], near: [] };
  const motes: Mote[] = [];

  function rebuild() {
    const n = w < 768 ? cfg.count / 2 : cfg.count;
    const targets: Record<Layer, number> = {
      far: Math.round(n * 0.35),
      mid: Math.round(n * 0.55),
      near: n > 0 ? Math.max(1, Math.round(n * 0.07)) : 0,
    };
    for (const k of LAYER_KEYS) {
      const arr = pools[k];
      while (arr.length < targets[k]) arr.push(spawn(k, true));
      arr.length = targets[k];
    }
    const mt = cfg.motes ? (w < 768 ? 8 : 16) : 0;
    while (motes.length < mt) motes.push(makeMote(true));
    motes.length = mt;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    rebuild();
  }

  // ---------- 鼠标扰动 ----------
  const pointer = { x: -9999, y: -9999, vx: 0, vy: 0 };
  function onMove(e: PointerEvent) {
    if (pointer.x > -9000) {
      pointer.vx = e.clientX - pointer.x;
      pointer.vy = e.clientY - pointer.y;
    }
    pointer.x = e.clientX; pointer.y = e.clientY;
  }
  function onLeave() { pointer.x = pointer.y = -9999; pointer.vx = pointer.vy = 0; }

  // ---------- 渲染 ----------
  let raf = 0, last = performance.now(), t = 0;
  let gust = 0, gustTarget = 0, nextGust = 300;
  const R = 140;

  function update(p: Petal, dt: number, wind: number) {
    const dx = p.x - pointer.x, dy = p.y - pointer.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < R * R) {
      const f = (1 - Math.sqrt(d2) / R) * 0.05 * p.depth;
      p.pvx += pointer.vx * f;
      p.pvy += pointer.vy * f * 0.6;
      p.vflip += f * 0.01;
    }
    p.pvx = Math.max(-8, Math.min(8, p.pvx * 0.96));
    p.pvy = Math.max(-6, Math.min(6, p.pvy * 0.94));
    p.vflip += (0.03 - p.vflip) * 0.002;

    p.sway += p.swaySpeed * dt;
    p.flip += p.vflip * dt * (1 + Math.abs(gust) * 0.8);
    p.rot += p.vr * dt;
    p.x += (p.vx + wind * p.depth + Math.sin(p.sway) * p.swayAmp + p.pvx) * dt;
    p.y += (p.vy + p.pvy + Math.cos(p.sway * 2) * 0.1) * dt;
  }

  function draw(p: Petal) {
    const c = Math.cos(p.flip);
    const sx = p.blossom ? p.scale : p.scale * c;
    const sy = p.blossom ? p.scale * (0.62 + 0.38 * c) : p.scale;
    const cr = Math.cos(p.rot), sr = Math.sin(p.rot);
    ctx.globalAlpha = p.alpha * cfg.opacity * (p.blossom ? 1 : 0.55 + 0.45 * Math.abs(c));
    ctx.setTransform(dpr * cr * sx, dpr * sr * sx, -dpr * sr * sy, dpr * cr * sy, dpr * p.x, dpr * p.y);
    const s = p.sprite;
    ctx.drawImage(s.cv, -s.size / 2, -s.size / 2);
  }

  function stepLayer(arr: Petal[], layer: Layer, dt: number, wind: number) {
    const m = layer === "near" ? 120 : 60;
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      update(p, dt, wind);
      if (p.y > h + m || p.x < -m * 2 || p.x > w + m * 2) { arr[i] = spawn(layer, false); continue; }
      draw(p);
    }
  }

  function tick(now: number) {
    const dt = Math.min((now - last) / 16.67, 3);
    last = now; t += dt;

    if (t > nextGust) {
      gustTarget = gustTarget ? 0 : rand(0.6, 1.4) * (Math.random() < 0.8 ? 1 : -1);
      nextGust = t + (gustTarget ? rand(120, 240) : rand(360, 720));
    }
    gust += (gustTarget - gust) * 0.008 * dt;
    const wind = (Math.sin(t * 0.003) * 0.3 + Math.sin(t * 0.0011 + 1) * 0.2 + gust) * cfg.wind;
    pointer.vx *= 0.85; pointer.vy *= 0.85;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    stepLayer(pools.far, "far", dt, wind);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < motes.length; i++) {
      const m = motes[i];
      m.phase += m.tw * dt;
      m.x += (m.vx + wind * 0.2) * dt;
      m.y += m.vy * dt;
      if (m.y < -40 || m.x < -40 || m.x > w + 40) { motes[i] = makeMote(false); motes[i].x = rand(0, w); continue; }
      ctx.globalAlpha = m.alpha * (0.5 + 0.5 * Math.sin(m.phase)) * cfg.opacity;
      ctx.drawImage(moteSprite.cv, m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
    }
    ctx.globalCompositeOperation = "source-over";

    stepLayer(pools.mid, "mid", dt, wind);
    stepLayer(pools.near, "near", dt, wind);

    raf = requestAnimationFrame(tick);
  }

  function start() { cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(tick); }
  function onVisibility() { if (document.hidden) cancelAnimationFrame(raf); else start(); }

  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerleave", onLeave);
  document.addEventListener("visibilitychange", onVisibility);
  start();

  return {
    set(o: Partial<SakuraConfig>) { Object.assign(cfg, o); if ("count" in o || "motes" in o) rebuild(); },
    stop() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    },
  };
}

type Props = Partial<SakuraConfig> & {
  /** 层级，想放在内容下面就给小一点 */
  zIndex?: number;
  /** 系统开了“减少动态效果”时不渲染（Windows 关掉“动画效果”也算） */
  respectReducedMotion?: boolean;
};

export default function SakuraPetals({
  count = 40,
  opacity = 1,
  wind = 1,
  motes = true,
  zIndex = 50,
  respectReducedMotion = true,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const engine = useRef<ReturnType<typeof startSakura>>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (respectReducedMotion && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    engine.current = startSakura(ref.current, { count, opacity, wind, motes });
    return () => {
      engine.current?.stop();
      engine.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [respectReducedMotion]);

  useEffect(() => {
    engine.current?.set({ count, opacity, wind, motes });
  }, [count, opacity, wind, motes]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", pointerEvents: "none", zIndex }}
    />
  );
}
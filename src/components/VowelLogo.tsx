import { useEffect, useRef } from 'react';

const TAU = Math.PI * 2;
const VIEWBOX_SIZE = 100;
const CANVAS_PADDING = 2;
const NODE_RADIUS = VIEWBOX_SIZE * 0.155;
const CORE_RADIUS = NODE_RADIUS * 0.5;

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function easeOut(t: number) { return 1 - Math.pow(1 - t, 3); }
function ease(t: number) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3) / 2; }
function clamp(v: number, lo = 0, hi = 1) { return Math.max(lo, Math.min(hi, v)); }
function rgba(c: number[], a: number) { return `rgba(${c[0]},${c[1]},${c[2]},${Math.min(a, 1)})`; }

const P = [88, 162, 255];
const WH = [214, 236, 255];
const DM = [18, 32, 58];

interface Trail { x: number; y: number; life: number; size: number; }
interface Ripple { x: number; y: number; life: number; maxR: number; }
interface Node { x: number; y: number; glow: number; }

function glowDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: number[], alpha: number, blur: number) {
  ctx.save();
  ctx.shadowBlur = blur;
  ctx.shadowColor = rgba(color, alpha * 0.7);
  ctx.fillStyle = rgba(color, alpha);
  ctx.beginPath();
  ctx.arc(x, y, Math.max(r, 0.5), 0, TAU);
  ctx.fill();
  ctx.restore();
}

function dimDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.fillStyle = rgba(DM, 0.5);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function dimLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number) {
  ctx.strokeStyle = rgba(DM, 0.4);
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function glowLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, color: number[], alpha: number, blur: number) {
  ctx.save();
  ctx.shadowBlur = blur;
  ctx.shadowColor = rgba(color, alpha);
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

interface VowelLogoProps {
  size?: number;
}

export default function VowelLogo({ size = 28 }: VowelLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<{
    trails: Trail[];
    ripples: Ripple[];
    center: Node;
    outer: Node[];
    rafId: number;
  } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 2;
    const paddedCssSize = size * CANVAS_PADDING;
    const bleedCss = (paddedCssSize - size) / 2;
    const pxSize = paddedCssSize * dpr;
    const scale = (size * dpr) / VIEWBOX_SIZE;

    canvas.width = pxSize;
    canvas.height = pxSize;
    canvas.style.width = `${paddedCssSize}px`;
    canvas.style.height = `${paddedCssSize}px`;

    const W = pxSize;
    const cx = VIEWBOX_SIZE / 2;
    const cy = VIEWBOX_SIZE / 2;
    const S = 1;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const R = NODE_RADIUS * 2;
    const CYCLE = 4.2;

    const center = { x: cx, y: cy, glow: 0 };
    const outer = [
      { x: center.x - R * 0.92, y: center.y - R * 0.72, glow: 0 },
      { x: center.x, y: center.y + R * 1.44, glow: 0 },
      { x: center.x + R * 0.92, y: center.y - R * 0.72, glow: 0 },
    ];

    const trails: Trail[] = [];
    const ripples: Ripple[] = [];
    const chainSegments = [
      [outer[0], outer[1]],
      [outer[1], outer[2]],
      [outer[2], center],
      [center, outer[0]],
    ] as const;

    stateRef.current = { trails, ripples, center, outer, rafId: 0 };

    const MAX_TRAILS = 200;
    const MAX_RIPPLES = 20;

    function animate(time: number) {
      if (!ctx) return;
      const t = (time / 1000) % CYCLE;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, W);
      ctx.setTransform(scale, 0, 0, scale, bleedCss * dpr, bleedCss * dpr);

      outer.forEach(node => dimLine(ctx, center.x, center.y, node.x, node.y, 1.5 * S));
      dimDot(ctx, center.x, center.y, NODE_RADIUS * S);
      outer.forEach(node => dimDot(ctx, node.x, node.y, NODE_RADIUS * S));

      center.glow = Math.max(0, center.glow - 0.022);
      outer.forEach(node => node.glow = Math.max(0, node.glow - 0.022));

      if (t < 0.35) {
        const p = t / 0.35;
        center.glow = Math.max(center.glow, p < 0.3 ? p / 0.3 : 1 - easeOut((p - 0.3) / 0.7));
        if (t < 0.05 && ripples.length < 2) ripples.push({ x: center.x, y: center.y, life: 1, maxR: 35 * S });
      }

      outer.forEach((node, i) => {
        const start = 0.25 + i * 0.08;
        const dur = 0.55;
        const p = clamp((t - start) / dur);
        if (p > 0 && p < 1) {
          const ep = ease(p);
          const x = lerp(center.x, node.x, ep);
          const y = lerp(center.y, node.y, ep);
          glowLine(ctx, center.x, center.y, x, y, 2.5 * S, P, 0.35 * (1 - p * 0.7), 12 * S);
          glowDot(ctx, x, y, NODE_RADIUS * 0.78 * S * (1 - p * 0.2), P, 1, 20 * S);
          glowDot(ctx, x, y, CORE_RADIUS * 0.88 * S, WH, 0.85, 5 * S);
          if (Math.random() < 0.6) trails.push({ x: x + (Math.random() - 0.5) * 3 * S, y: y + (Math.random() - 0.5) * 3 * S, life: 0.8, size: 1.5 * S });
        }
        if (p >= 0.88) {
          node.glow = Math.max(node.glow, easeOut((p - 0.88) / 0.12));
          if (p > 0.95 && !ripples.some(r => Math.abs(r.x - node.x) < 1)) ripples.push({ x: node.x, y: node.y, life: 1, maxR: 14 * S });
        }
      });

      [0, 2].forEach((ni, idx) => {
        const node = outer[ni];
        const start = 1.5 + idx * 0.15;
        const p = clamp((t - start) / 0.6);
        if (p > 0 && p < 1) {
          const ep = ease(p);
          const x = lerp(node.x, center.x, ep);
          const y = lerp(node.y, center.y, ep);
          glowLine(ctx, node.x, node.y, x, y, 2 * S, P, 0.3 * (1 - p * 0.5), 10 * S);
          glowDot(ctx, x, y, NODE_RADIUS * 0.67 * S, P, 0.9, 16 * S);
          glowDot(ctx, x, y, CORE_RADIUS * 0.75 * S, WH, 0.7, 4 * S);
          if (Math.random() < 0.4) trails.push({ x, y, life: 0.6, size: 1.2 * S });
        }
        if (p >= 0.9) center.glow = Math.max(center.glow, 0.6);
      });

      chainSegments.forEach(([from, to], i) => {
        const start = 2.5 + i * 0.12;
        const p = clamp((t - start) / 0.28);
        if (p > 0 && p < 1) {
          const ep = ease(p);
          const x = lerp(from.x, to.x, ep);
          const y = lerp(from.y, to.y, ep);
          glowLine(ctx, from.x, from.y, x, y, 2 * S, P, 0.5 * (1 - p * 0.3), 8 * S);
          glowDot(ctx, x, y, NODE_RADIUS * 0.56 * S, P, 0.8, 12 * S);
          if (Math.random() < 0.3) trails.push({ x, y, life: 0.5, size: 1 * S });
        }
        if (t > start + 0.24 && t < start + 0.39) {
          to.glow = Math.max(to.glow, 0.65);
        }
      });

      if (trails.length > MAX_TRAILS) trails.splice(0, trails.length - MAX_TRAILS);
      if (ripples.length > MAX_RIPPLES) ripples.splice(0, ripples.length - MAX_RIPPLES);

      for (let i = ripples.length - 1; i >= 0; i--) {
        const ripple = ripples[i];
        ripple.life -= 0.018;
        if (ripple.life <= 0) {
          ripples.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.strokeStyle = rgba(P, ripple.life * 0.25);
        ctx.lineWidth = Math.max(1, 1.5 * S * ripple.life);
        ctx.shadowBlur = 8 * S;
        ctx.shadowColor = rgba(P, ripple.life * 0.15);
        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, (1 - ripple.life) * ripple.maxR, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }

      for (let i = trails.length - 1; i >= 0; i--) {
        const trail = trails[i];
        trail.life -= 0.045;
        if (trail.life <= 0) {
          trails.splice(i, 1);
          continue;
        }
        glowDot(ctx, trail.x, trail.y, trail.size * trail.life, P, trail.life * 0.45, 5 * S);
      }

      if (center.glow > 0.01) {
        glowDot(ctx, center.x, center.y, NODE_RADIUS * S * (1 + center.glow * 0.25), P, center.glow * 0.75, 28 * S);
        glowDot(ctx, center.x, center.y, CORE_RADIUS * S, WH, center.glow * 0.45, 8 * S);
      }
      outer.forEach(node => {
        if (node.glow > 0.01) {
          glowDot(ctx, node.x, node.y, NODE_RADIUS * S * (1 + node.glow * 0.25), P, node.glow * 0.7, 18 * S);
          glowDot(ctx, node.x, node.y, CORE_RADIUS * 0.63 * S, WH, node.glow * 0.35, 5 * S);
        }
      });

      const breathe = 0.03 + 0.02 * Math.sin(time / 1000 * 1.2);
      glowDot(ctx, center.x, center.y, NODE_RADIUS * 0.58 * S, P, breathe, 15 * S);

      if (stateRef.current) stateRef.current.rafId = requestAnimationFrame(animate);
    }

    if (prefersReducedMotion) {
      animate(0);
      return;
    }

    stateRef.current.rafId = requestAnimationFrame(animate);

    return () => {
      if (stateRef.current) cancelAnimationFrame(stateRef.current.rafId);
    };
  }, [size]);

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        position: 'relative',
        overflow: 'visible',
        flexShrink: 0,
      }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Vowel logo"
        style={{
          display: 'block',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

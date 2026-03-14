import { useEffect, useRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { IconType } from 'react-icons';
import { BsStars } from 'react-icons/bs';
import { IoChatboxOutline } from 'react-icons/io5';
import { LuBrain } from 'react-icons/lu';

const TAU = Math.PI * 2;
const VIEWBOX_SIZE = 100;
const CANVAS_PADDING = 2;
const NODE_RADIUS = VIEWBOX_SIZE * 0.155;
const ICON_RADIUS = NODE_RADIUS * 0.74;
const WORD_FONT_SIZE = VIEWBOX_SIZE * 0.15;
const OCR_FONT_FAMILY = 'Vowel OCR A';

const P = [88, 162, 255];
const WH = [214, 236, 255];
const DM = [18, 32, 58];

const ICONS = [LuBrain, IoChatboxOutline, BsStars] as const;

interface Trail { x: number; y: number; life: number; size: number; }
interface Ripple { x: number; y: number; life: number; maxR: number; }
let ocrFontPromise: Promise<void> | null = null;
const iconCache = new Map<string, Promise<HTMLImageElement>>();

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function easeOut(t: number) { return 1 - Math.pow(1 - t, 3); }
function ease(t: number) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3) / 2; }
function clamp(v: number, lo = 0, hi = 1) { return Math.max(lo, Math.min(hi, v)); }
function rgba(c: number[], a: number) { return `rgba(${c[0]},${c[1]},${c[2]},${Math.min(a, 1)})`; }
function nodeVisibilityOf(node: object, fallback: number) {
  const candidate = node as { visibility?: number };
  return typeof candidate.visibility === 'number' ? candidate.visibility : fallback;
}

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

function dimDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha = 0.5) {
  ctx.fillStyle = rgba(DM, alpha);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function dimLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, alpha = 0.4) {
  ctx.strokeStyle = rgba(DM, alpha);
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

async function ensureOcrFont() {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  if (!ocrFontPromise) {
    ocrFontPromise = (async () => {
      const font = new FontFace(OCR_FONT_FAMILY, 'url(/fonts/OCR-A_Regular.otf)');
      await font.load();
      document.fonts.add(font);
      await document.fonts.load(`24px "${OCR_FONT_FAMILY}"`);
    })();
  }
  await ocrFontPromise;
}

async function loadIcon(Icon: IconType, color: string) {
  const key = `${Icon.name}:${color}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const svg = renderToStaticMarkup(<Icon color={color} />);
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });

  iconCache.set(key, promise);
  return promise;
}

function drawIcon(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, r: number, alpha: number) {
  const size = r * 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(image, x - r, y - r, size, size);
  ctx.restore();
}

function drawGlowText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  alpha: number,
  align: CanvasTextAlign,
) {
  ctx.textAlign = align;
  ctx.fillStyle = rgba(P, alpha);
  ctx.shadowBlur = 20;
  ctx.shadowColor = rgba(P, alpha * 0.85);
  ctx.fillText(text, x, y);
  ctx.fillStyle = rgba(WH, alpha * 0.82);
  ctx.shadowBlur = 8;
  ctx.shadowColor = rgba(WH, alpha * 0.6);
  ctx.fillText(text, x, y);
}

function drawWord(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  suffix: string,
  baseAlpha: number,
  suffixAlpha: number,
  scale: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.textBaseline = 'middle';
  ctx.font = `${WORD_FONT_SIZE}px "${OCR_FONT_FAMILY}"`;
  const vWidth = ctx.measureText('v').width;
  const suffixWidth = ctx.measureText(suffix).width;
  const startX = -(vWidth + suffixWidth) / 2;

  drawGlowText(ctx, 'v', startX, 2, baseAlpha, 'left');
  if (suffix.length > 0) drawGlowText(ctx, suffix, startX + vWidth, 2, suffixAlpha, 'left');
  ctx.restore();
}

interface VowelLogoProps {
  size?: number;
}

export default function VowelLogo({ size = 28 }: VowelLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rawContext = canvas.getContext('2d');
    if (!rawContext) return;
    const context: CanvasRenderingContext2D = rawContext;

    const dpr = window.devicePixelRatio || 2;
    const paddedCssSize = size * CANVAS_PADDING;
    const bleedCss = (paddedCssSize - size) / 2;
    const pxSize = paddedCssSize * dpr;
    const scale = (size * dpr) / VIEWBOX_SIZE;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    canvas.width = pxSize;
    canvas.height = pxSize;
    canvas.style.width = `${paddedCssSize}px`;
    canvas.style.height = `${paddedCssSize}px`;

    let rafId = 0;
    let cancelled = false;

    const W = pxSize;
    const cx = VIEWBOX_SIZE / 2;
    const cy = VIEWBOX_SIZE / 2;
    const S = 1;
    const R = NODE_RADIUS * 2;
    const CYCLE = 5.7;

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

    const MAX_TRAILS = 200;
    const MAX_RIPPLES = 20;

    const start = async () => {
      const iconImages = await Promise.all(ICONS.map(icon => loadIcon(icon, rgba(WH, 1))));
      await ensureOcrFont();
      if (cancelled) return;

      function animate(time: number) {
        const t = (time / 1000) % CYCLE;
        const typeProgress = clamp((t - 2.95) / 0.9);
        const untypeProgress = clamp((t - 4.1) / 0.75);
        const textVisibility = clamp(ease(typeProgress) - ease(untypeProgress));
        const textScale = 1;
        const circleRedraw = ease(clamp((t - 4.95) / 0.42));
        const typedLetters = Math.max(1, Math.min(5, 1 + Math.floor(ease(typeProgress) * 4.999)));
        const untypedLetters = Math.max(1, 5 - Math.floor(ease(untypeProgress) * 4.999));
        const currentWord = 'vowel'.slice(0, t < 4.1 ? typedLetters : untypedLetters);
        const suffix = currentWord.slice(1);
        const animatedOuter = outer.map((node, i) => {
          const enterStart = 0.1 + i * 0.12;
          const enterProgress = easeOut(clamp((t - enterStart) / 0.5));
          const stagedX = lerp(center.x, node.x, enterProgress);
          const stagedY = lerp(center.y, node.y, enterProgress);
          const exitStart = 2.2 + i * 0.18;
          const exitProgress = ease(clamp((t - exitStart) / 0.6));
          return {
            ...node,
            x: lerp(stagedX, center.x, exitProgress),
            y: lerp(stagedY, center.y, exitProgress),
            visibility: enterProgress * (1 - exitProgress),
          };
        });
        const nodeVisibility = animatedOuter.reduce((max, node) => Math.max(max, node.visibility), 0);
        const showNodeCircles = nodeVisibility > 0.015;

        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, W, W);
        context.setTransform(scale, 0, 0, scale, bleedCss * dpr, bleedCss * dpr);

        if (showNodeCircles) {
          animatedOuter.forEach(node => dimLine(context, center.x, center.y, node.x, node.y, 1.5 * S, 0.4 * node.visibility));
          dimDot(context, center.x, center.y, NODE_RADIUS * S, 0.18 + 0.16 * nodeVisibility);
          animatedOuter.forEach(node => dimDot(context, node.x, node.y, NODE_RADIUS * S, 0.12 + 0.3 * node.visibility));
        }

        center.glow = Math.max(0, center.glow - 0.022);
        outer.forEach(node => node.glow = Math.max(0, node.glow - 0.022));

        if (t < 0.35) {
          const p = t / 0.35;
          center.glow = Math.max(center.glow, p < 0.3 ? p / 0.3 : 1 - easeOut((p - 0.3) / 0.7));
          if (t < 0.05 && ripples.length < 2) ripples.push({ x: center.x, y: center.y, life: 1, maxR: 35 * S });
        }

        outer.forEach((node, i) => {
          const startTime = 0.25 + i * 0.08;
          const dur = 0.55;
          const p = clamp((t - startTime) / dur);
          const animatedNode = animatedOuter[i];
          if (p > 0 && p < 1 && animatedNode.visibility > 0.01 && showNodeCircles) {
            const ep = ease(p);
            const x = lerp(center.x, animatedNode.x, ep);
            const y = lerp(center.y, animatedNode.y, ep);
            glowLine(context, center.x, center.y, x, y, 2.5 * S, P, 0.35 * (1 - p * 0.7) * animatedNode.visibility, 12 * S);
            glowDot(context, x, y, NODE_RADIUS * 0.78 * S * (1 - p * 0.2), P, animatedNode.visibility, 20 * S);
            if (Math.random() < 0.6) trails.push({ x: x + (Math.random() - 0.5) * 3 * S, y: y + (Math.random() - 0.5) * 3 * S, life: 0.8, size: 1.5 * S });
          }
          if (p >= 0.88) {
            node.glow = Math.max(node.glow, easeOut((p - 0.88) / 0.12));
            if (p > 0.95 && !ripples.some(r => Math.abs(r.x - node.x) < 1)) ripples.push({ x: node.x, y: node.y, life: 1, maxR: 14 * S });
          }
        });

        [0, 2].forEach((ni, idx) => {
          const animatedNode = animatedOuter[ni];
          const startTime = 1.5 + idx * 0.15;
          const p = clamp((t - startTime) / 0.6);
          if (p > 0 && p < 1 && animatedNode.visibility > 0.01 && showNodeCircles) {
            const ep = ease(p);
            const x = lerp(animatedNode.x, center.x, ep);
            const y = lerp(animatedNode.y, center.y, ep);
            glowLine(context, animatedNode.x, animatedNode.y, x, y, 2 * S, P, 0.3 * (1 - p * 0.5) * animatedNode.visibility, 10 * S);
            glowDot(context, x, y, NODE_RADIUS * 0.67 * S, P, 0.9 * animatedNode.visibility, 16 * S);
            if (Math.random() < 0.4) trails.push({ x, y, life: 0.6, size: 1.2 * S });
          }
          if (p >= 0.9) center.glow = Math.max(center.glow, 0.6);
        });

        chainSegments.forEach(([from, to], i) => {
          const startTime = 2.5 + i * 0.12;
          const p = clamp((t - startTime) / 0.28);
          const fromIndex = outer.indexOf(from);
          const toIndex = outer.indexOf(to);
          const animatedFrom = fromIndex >= 0 ? animatedOuter[fromIndex] : from;
          const animatedTo = toIndex >= 0 ? animatedOuter[toIndex] : to;
          const segmentVisibility = Math.min(
            nodeVisibilityOf(animatedFrom, nodeVisibility),
            nodeVisibilityOf(animatedTo, nodeVisibility),
          );
          if (p > 0 && p < 1 && segmentVisibility > 0.01 && showNodeCircles) {
            const ep = ease(p);
            const x = lerp(animatedFrom.x, animatedTo.x, ep);
            const y = lerp(animatedFrom.y, animatedTo.y, ep);
            glowLine(context, animatedFrom.x, animatedFrom.y, x, y, 2 * S, P, 0.5 * (1 - p * 0.3) * segmentVisibility, 8 * S);
            glowDot(context, x, y, NODE_RADIUS * 0.56 * S, P, 0.8 * segmentVisibility, 12 * S);
            if (Math.random() < 0.3) trails.push({ x, y, life: 0.5, size: 1 * S });
          }
          if (t > startTime + 0.24 && t < startTime + 0.39) {
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
          context.save();
          context.strokeStyle = rgba(P, ripple.life * 0.25 * nodeVisibility * (showNodeCircles ? 1 : 0));
          context.lineWidth = Math.max(1, 1.5 * S * ripple.life);
          context.shadowBlur = 8 * S;
          context.shadowColor = rgba(P, ripple.life * 0.15 * nodeVisibility * (showNodeCircles ? 1 : 0));
          context.beginPath();
          context.arc(ripple.x, ripple.y, (1 - ripple.life) * ripple.maxR, 0, TAU);
          context.stroke();
          context.restore();
        }

        for (let i = trails.length - 1; i >= 0; i--) {
          const trail = trails[i];
          trail.life -= 0.045;
          if (trail.life <= 0) {
            trails.splice(i, 1);
            continue;
          }
          glowDot(context, trail.x, trail.y, trail.size * trail.life, P, trail.life * 0.45 * nodeVisibility * (showNodeCircles ? 1 : 0), 5 * S);
        }

        if (nodeVisibility > 0.01 && showNodeCircles) {
          if (center.glow > 0.01) {
            glowDot(context, center.x, center.y, NODE_RADIUS * S * (1 + center.glow * 0.25), P, center.glow * 0.45 * nodeVisibility, 28 * S);
          }
          animatedOuter.forEach((node, index) => {
            if (node.glow > 0.01) {
              glowDot(context, node.x, node.y, NODE_RADIUS * S * (1 + node.glow * 0.22), P, node.glow * 0.55 * node.visibility, 18 * S);
            }
            drawIcon(context, iconImages[index], node.x, node.y, ICON_RADIUS, 0.28 * node.visibility);
            drawIcon(context, iconImages[index], node.x, node.y, ICON_RADIUS * 0.92, 0.95 * node.visibility);
          });
        }

        const breathe = 0.03 + 0.02 * Math.sin(time / 1000 * 1.2);
        if (showNodeCircles) {
          glowDot(context, center.x, center.y, NODE_RADIUS * 0.52 * S, P, breathe * (0.45 + nodeVisibility * 0.55), 15 * S);
        }

        if (circleRedraw > 0.01) {
          glowDot(context, center.x, center.y, NODE_RADIUS * (0.45 + circleRedraw * 0.55), P, 0.3 * circleRedraw, 22 * S);
          dimDot(context, center.x, center.y, NODE_RADIUS * circleRedraw, 0.28 * circleRedraw);
        }

        drawWord(
          context,
          center.x,
          center.y,
          textVisibility > 0.01 ? suffix : '',
          1,
          textVisibility > 0.01 ? textVisibility : 0,
          textVisibility > 0.01 ? textScale : 1,
        );

        rafId = requestAnimationFrame(animate);
      }

      if (prefersReducedMotion) {
        animate(0);
        return;
      }

      rafId = requestAnimationFrame(animate);
    };

    void start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
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

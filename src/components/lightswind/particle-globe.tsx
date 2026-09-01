import { useEffect, useRef } from "react";

interface ParticleGlobeProps {
  /** number of points distributed on the sphere */
  pointCount?: number;
  /** base rotation speed (radians per frame) */
  speed?: number;
  className?: string;
}

interface GlobePoint {
  /** unit sphere coordinates */
  x: number;
  y: number;
  z: number;
  size: number;
  twinkle: number;
}

/**
 * Fibonacci-sphere particle globe. Rotates slowly, reacts subtly to the
 * pointer, and fades out toward the left edge so it dissolves into the
 * cosmic dust background.
 */
export default function ParticleGlobe({
  pointCount = 1400,
  speed = 0.0016,
  className,
}: ParticleGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;

    const resize = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      if (!w || !h || (w === width && h === height)) return;
      width = w;
      height = h;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    // The globe lives in a `hidden lg:flex` container, so it can mount at 0x0.
    // Observe the element so it initialises the moment it becomes visible.
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const points: GlobePoint[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < pointCount; i++) {
      const y = 1 - (i / (pointCount - 1)) * 2;
      const radius = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;
      points.push({
        x: Math.cos(theta) * radius,
        y,
        z: Math.sin(theta) * radius,
        size: Math.random() * 0.9 + 0.5,
        twinkle: Math.random() * Math.PI * 2,
      });
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerRef.current.tx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerRef.current.ty = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    window.addEventListener("mousemove", handleMouseMove);

    let raf = 0;
    let angle = 0;

    const render = (t: number) => {
      raf = requestAnimationFrame(render);
      ctx.clearRect(0, 0, width, height);
      if (!width || !height) return;

      const p = pointerRef.current;
      p.x += (p.tx - p.x) * 0.05;
      p.y += (p.ty - p.y) * 0.05;

      angle += speed;
      const yaw = angle + p.x * 0.35;
      const pitch = -0.25 + p.y * 0.25;

      const cx = width / 2;
      const cy = height / 2;
      const R = Math.min(width, height) * 0.42;
      const perspective = 2.6;

      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);

      for (let i = 0; i < points.length; i++) {
        const pt = points[i]!;

        // rotate around Y then X
        const x1 = pt.x * cosY - pt.z * sinY;
        const z1 = pt.x * sinY + pt.z * cosY;
        const y2 = pt.y * cosP - z1 * sinP;
        const z2 = pt.y * sinP + z1 * cosP;

        const scale = perspective / (perspective - z2);
        const sx = cx + x1 * R * scale;
        const sy = cy + y2 * R * scale;

        // depth-based brightness
        const depth = (z2 + 1) / 2; // 0 back .. 1 front
        let alpha = 0.12 + depth * 0.85;

        // horizontal dissolve: fade the left edge into the background
        const hx = (sx - (cx - R)) / (2 * R); // 0 left .. 1 right
        alpha *= Math.max(0.18, Math.min(1, hx * 1.6 + 0.1));

        // gentle twinkle
        alpha *= 0.8 + Math.sin(t * 0.0015 + pt.twinkle) * 0.2;

        if (alpha <= 0.01) continue;

        const size = pt.size * scale * (0.9 + depth * 0.8);
        const warm = depth > 0.72;

        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fillStyle = warm
          ? `rgba(226, 246, 255, ${alpha})`
          : `rgba(150, 205, 245, ${alpha * 0.85})`;
        ctx.fill();
      }
    };

    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [pointCount, speed]);

  return <canvas ref={canvasRef} className={className ?? "h-full w-full"} aria-hidden="true" />;
}

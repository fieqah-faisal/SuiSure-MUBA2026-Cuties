import React, { useEffect, useRef, useState } from "react";

interface CosmicDustProps {
  particleCount?: number;
  speedMultiplier?: number;
  particleSize?: number;
  theme?: "light" | "dark" | "system";
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  opacity: number;
  history: { x: number; y: number }[];
}

export default function CosmicDust({
  particleCount = 120,
  speedMultiplier = 1.0,
  particleSize = 1.5,
  theme = "system",
  className,
}: CosmicDustProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0, hasMoved: false });
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const checkTheme = () => {
      if (theme === "system") {
        setIsDarkMode(
          document.documentElement.classList.contains("dark") ||
            getComputedStyle(document.documentElement).colorScheme === "dark",
        );
      } else {
        setIsDarkMode(theme === "dark");
      }
    };

    checkTheme();

    if (theme === "system") {
      const observer = new MutationObserver(checkTheme);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      return () => observer.disconnect();
    }
    return undefined;
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId = 0;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    mouseRef.current.targetX = width / 2;
    mouseRef.current.targetY = height / 2;

    const colorsDark = [
      "rgba(160, 235, 255,",
      "rgba(110, 205, 255,",
      "rgba(220, 245, 255,",
      "rgba(250, 252, 255,",
    ];

    const colorsLight = [
      "rgba(37, 99, 235,",
      "rgba(14, 116, 165,",
      "rgba(80, 140, 220,",
      "rgba(120, 170, 240,",
    ];

    const createParticle = (initRandom = false): Particle => {
      const pX = Math.random() * width;
      const pY = initRandom ? Math.random() * height : height + 10;
      const pColorSet = isDarkMode ? colorsDark : colorsLight;
      const baseColor = pColorSet[Math.floor(Math.random() * pColorSet.length)] as string;

      return {
        x: pX,
        y: pY,
        vx: (Math.random() - 0.5) * 1.8 * speedMultiplier,
        vy: (-Math.random() - 0.2) * 2.1 * speedMultiplier,
        size: (Math.random() * 1.2 + 1.0) * particleSize,
        color: baseColor,
        opacity: Math.random() * 0.25 + 0.6,
        history: [],
      };
    };

    let particles: Particle[] = Array.from({ length: particleCount }, () =>
      createParticle(true),
    );

    const handleResize = () => {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener("resize", handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.targetX = e.clientX - rect.left;
      mouseRef.current.targetY = e.clientY - rect.top;
      mouseRef.current.hasMoved = true;
    };
    window.addEventListener("mousemove", handleMouseMove);

    const animate = (t: number) => {
      animationId = requestAnimationFrame(animate);
      ctx.clearRect(0, 0, width, height);

      if (!mouseRef.current.hasMoved) {
        const cx = width / 2;
        const cy = height / 2;
        const radius = Math.min(width, height) * 0.15;
        mouseRef.current.targetX = cx + Math.cos(t * 0.001) * radius;
        mouseRef.current.targetY = cy + Math.sin(t * 0.001) * radius;
      }

      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.08;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.08;

      const mX = mouseRef.current.x;
      const mY = mouseRef.current.y;

      particles.forEach((p, index) => {
        p.vx += Math.sin(t * 0.002 + index) * 0.02 * speedMultiplier;

        const dx = mX - p.x;
        const dY = mY - p.y;
        const dist = Math.sqrt(dx * dx + dY * dY) || 1;
        const influenceRadius = 180;

        if (dist < influenceRadius) {
          const force = (1.0 - dist / influenceRadius) * 0.8 * speedMultiplier;
          p.vx += (dx / dist) * force * 0.04;
          p.vy += (dY / dist) * force * 0.04;

          const tx = -dY / dist;
          const ty = dx / dist;
          p.vx += tx * force * 0.18;
          p.vy += ty * force * 0.18;
        }

        p.vx *= 0.96;
        p.vy *= 0.96;
        p.x += p.vx;
        p.y += p.vy;

        p.history.push({ x: p.x, y: p.y });
        if (p.history.length > 14) p.history.shift();

        if (p.y < -10 || p.x < -10 || p.x > width + 10) {
          particles[index] = createParticle(false);
          return;
        }

        if (p.history.length > 1) {
          ctx.beginPath();
          const pts = p.history;
          ctx.moveTo(pts[0]!.x, pts[0]!.y);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i]!.x, pts[i]!.y);
          }
          ctx.strokeStyle = `${p.color}${p.opacity * 0.55})`;
          ctx.lineWidth = p.size * 0.7;
          ctx.lineCap = "round";
          ctx.stroke();
        }
      });

      const connectionRadius = 95;
      const maxConnections = 2;
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i]!;
        let connections = 0;
        for (let j = i + 1; j < particles.length && connections < maxConnections; j++) {
          const p2 = particles[j]!;
          const cdx = p1.x - p2.x;
          const cdy = p1.y - p2.y;
          const cDist = Math.sqrt(cdx * cdx + cdy * cdy);
          if (cDist < connectionRadius) {
            const lineOpacity = (1 - cDist / connectionRadius) * 0.22 * Math.min(p1.opacity, p2.opacity);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `${p1.color}${lineOpacity})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
            connections++;
          }
        }
      }

      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);

        if (isDarkMode) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = `${p.color}0.9)`;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = `${p.color}${p.opacity})`;
        ctx.fill();
        ctx.shadowBlur = 0;
      });
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [particleCount, speedMultiplier, particleSize, isDarkMode]);

  return <canvas ref={canvasRef} className={className ?? "h-full w-full"} />;
}

"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useId,
  type CSSProperties,
  forwardRef,
  useImperativeHandle,
} from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

export type GrainFoilVariant =
  | "holographic"
  | "cosmic-cyan"
  | "neon-sakura"
  | "solar-plasma"
  | "cyber-emerald"
  | "ultra-violet"
  | "monochrome";

export interface GrainCarouselItem {
  id?: string | number;
  title?: string;
  subtitle?: string;
  category?: string;
  imageA: string;
  imageB?: string;
  badge?: string;
  href?: string;
  accentColor?: string;
  onClick?: () => void;
}

export interface GrainCarouselProps {
  items: GrainCarouselItem[];
  defaultIndex?: number;
  activeIndex?: number;
  onIndexChange?: (index: number, item: GrainCarouselItem) => void;
  cardWidth?: number;
  aspectRatio?: string;
  gap?: number;
  perspective?: number;
  lift?: number;
  maxTilt?: number;
  foilVariant?: GrainFoilVariant;
  grainAmount?: number;
  lenticularStrips?: number;
  inactiveScale?: number;
  inactiveDim?: number;
  showRibs?: boolean;
  showFoil?: boolean;
  showGrain?: boolean;
  showArrows?: boolean;
  showDots?: boolean;
  autoplay?: boolean;
  autoplayInterval?: number;
  pauseOnHover?: boolean;
  radius?: string | number;
  className?: string;
  style?: CSSProperties;
}

export interface GrainCarouselHandle {
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  getIndex: () => number;
}

const FOIL_GRADIENTS: Record<GrainFoilVariant, string> = {
  holographic:
    "linear-gradient(115deg, transparent 0%, rgba(255, 0, 128, 0.4) 25%, rgba(0, 255, 255, 0.5) 50%, rgba(255, 255, 0, 0.4) 75%, transparent 100%)",
  "cosmic-cyan":
    "linear-gradient(115deg, transparent 0%, rgba(0, 150, 255, 0.4) 25%, rgba(0, 245, 255, 0.6) 50%, rgba(120, 255, 214, 0.4) 75%, transparent 100%)",
  "neon-sakura":
    "linear-gradient(115deg, transparent 0%, rgba(255, 70, 150, 0.4) 25%, rgba(255, 160, 250, 0.6) 50%, rgba(180, 100, 255, 0.4) 75%, transparent 100%)",
  "solar-plasma":
    "linear-gradient(115deg, transparent 0%, rgba(255, 60, 0, 0.4) 25%, rgba(255, 160, 0, 0.6) 50%, rgba(255, 220, 50, 0.4) 75%, transparent 100%)",
  "cyber-emerald":
    "linear-gradient(115deg, transparent 0%, rgba(0, 200, 100, 0.4) 25%, rgba(0, 255, 140, 0.6) 50%, rgba(0, 230, 255, 0.4) 75%, transparent 100%)",
  "ultra-violet":
    "linear-gradient(115deg, transparent 0%, rgba(130, 0, 255, 0.4) 25%, rgba(190, 80, 255, 0.6) 50%, rgba(255, 70, 180, 0.4) 75%, transparent 100%)",
  monochrome:
    "linear-gradient(115deg, transparent 0%, rgba(255, 255, 255, 0.15) 30%, rgba(255, 255, 255, 0.4) 50%, rgba(255, 255, 255, 0.15) 70%, transparent 100%)",
};

type Interaction = {
  tiltX: number;
  tiltY: number;
  progress: number;
  foilX: number;
  foilY: number;
};

const NEUTRAL: Interaction = { tiltX: 0, tiltY: 0, progress: 0, foilX: 50, foilY: 50 };

export const GrainCarousel = forwardRef<GrainCarouselHandle, GrainCarouselProps>(
  (
    {
      items,
      defaultIndex,
      activeIndex: controlledIndex,
      onIndexChange,
      cardWidth = 270,
      aspectRatio = "3 / 4",
      gap = 24,
      perspective = 1200,
      lift = 36,
      maxTilt = 16,
      foilVariant = "cosmic-cyan",
      grainAmount = 0.35,
      lenticularStrips = 56,
      inactiveScale = 0.9,
      inactiveDim = 0.55,
      showRibs = true,
      showFoil = true,
      showGrain = true,
      showArrows = true,
      showDots = true,
      autoplay = false,
      autoplayInterval = 4000,
      pauseOnHover = true,
      radius = "16px",
      className,
      style,
    },
    ref,
  ) => {
    const rawDefault =
      defaultIndex !== undefined
        ? defaultIndex
        : Math.min(2, Math.max(0, Math.floor(items.length / 2)));
    const [internalIndex, setInternalIndex] = useState(rawDefault);
    const currentIndex = controlledIndex !== undefined ? controlledIndex : internalIndex;

    const [trackOffset, setTrackOffset] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const [cardInteractions, setCardInteractions] = useState<Record<number, Interaction>>({});

    const containerRef = useRef<HTMLDivElement | null>(null);
    const isDraggingRef = useRef(false);
    const dragStartXRef = useRef(0);

    const filterId = `grain-${useId().replace(/[:]/g, "")}`;
    const parsedRadius = typeof radius === "number" ? `${radius}px` : radius;

    const changeIndex = useCallback(
      (newIndex: number) => {
        const clamped = Math.max(0, Math.min(newIndex, items.length - 1));
        if (controlledIndex === undefined) setInternalIndex(clamped);
        const item = items[clamped];
        if (onIndexChange && item) onIndexChange(clamped, item);
      },
      [controlledIndex, items, onIndexChange],
    );

    useImperativeHandle(ref, () => ({
      next: () => changeIndex(currentIndex + 1),
      prev: () => changeIndex(currentIndex - 1),
      goTo: (idx: number) => changeIndex(idx),
      getIndex: () => currentIndex,
    }));

    const updateTrackPosition = useCallback(() => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.offsetWidth;
      const centerOffset = containerWidth / 2 - cardWidth / 2;
      setTrackOffset(centerOffset - currentIndex * (cardWidth + gap));
    }, [currentIndex, cardWidth, gap]);

    useEffect(() => {
      updateTrackPosition();
      const ro = new ResizeObserver(() => updateTrackPosition());
      if (containerRef.current) ro.observe(containerRef.current);
      return () => ro.disconnect();
    }, [updateTrackPosition]);

    useEffect(() => {
      if (!autoplay || (pauseOnHover && isHovered) || items.length <= 1) return;
      const timer = setInterval(() => {
        setInternalIndex((prev) => (prev >= items.length - 1 ? 0 : prev + 1));
      }, autoplayInterval);
      return () => clearInterval(timer);
    }, [autoplay, autoplayInterval, pauseOnHover, isHovered, items.length]);

    const handleCardMouseMove = (e: React.MouseEvent, index: number) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      setCardInteractions((prev) => ({
        ...prev,
        [index]: {
          tiltX: (0.5 - y) * (maxTilt * 1.5),
          tiltY: (x - 0.5) * (maxTilt * 2),
          progress: x,
          foilX: x * 100,
          foilY: y * 100,
        },
      }));
    };

    const handleCardMouseLeave = (index: number) => {
      setCardInteractions((prev) => ({ ...prev, [index]: NEUTRAL }));
    };

    const handleDragMove = (clientX: number) => {
      if (!isDraggingRef.current) return;
      const deltaX = clientX - dragStartXRef.current;
      if (Math.abs(deltaX) > 45) {
        if (deltaX > 0 && currentIndex > 0) changeIndex(currentIndex - 1);
        else if (deltaX < 0 && currentIndex < items.length - 1) changeIndex(currentIndex + 1);
        isDraggingRef.current = false;
      }
    };

    return (
      <div
        className={cn("relative w-full select-none", className)}
        style={style}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          isDraggingRef.current = false;
        }}
      >
        <svg aria-hidden className="pointer-events-none absolute h-0 w-0">
          <defs>
            <filter id={filterId}>
              <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={3} stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
          </defs>
        </svg>

        <div
          ref={containerRef}
          className="relative w-full overflow-hidden py-10"
          style={{ perspective: `${perspective}px` }}
          onMouseDown={(e) => {
            isDraggingRef.current = true;
            dragStartXRef.current = e.clientX;
          }}
          onMouseMove={(e) => handleDragMove(e.clientX)}
          onMouseUp={() => (isDraggingRef.current = false)}
          onTouchStart={(e) => {
            isDraggingRef.current = true;
            dragStartXRef.current = e.touches[0]!.clientX;
          }}
          onTouchMove={(e) => handleDragMove(e.touches[0]!.clientX)}
          onTouchEnd={() => (isDraggingRef.current = false)}
        >
          <div
            className="flex items-center transition-transform duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
            style={{
              gap: `${gap}px`,
              transform: `translate3d(${trackOffset}px, 0, 0)`,
              transformStyle: "preserve-3d",
            }}
          >
            {items.map((item, index) => {
              const isActive = index === currentIndex;
              const interaction = cardInteractions[index] ?? NEUTRAL;
              const hasDualImage = Boolean(item.imageB);
              const flipProgress = hasDualImage ? interaction.progress : 0;
              const foilOpacity = Math.sin(interaction.progress * Math.PI) * 0.75;

              return (
                <div
                  key={item.id ?? index}
                  onClick={() => {
                    if (!isActive) changeIndex(index);
                    item.onClick?.();
                  }}
                  onMouseMove={(e) => handleCardMouseMove(e, index)}
                  onMouseLeave={() => handleCardMouseLeave(index)}
                  className={cn(
                    "group relative shrink-0 cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                    isActive ? "z-20 shadow-2xl ring-1 ring-white/20" : "z-10 shadow-lg",
                  )}
                  style={{
                    width: `${cardWidth}px`,
                    aspectRatio,
                    borderRadius: parsedRadius,
                    transform: `scale(${isActive ? 1 : inactiveScale})`,
                    filter: isActive ? "brightness(1)" : `brightness(${inactiveDim})`,
                    transformStyle: "preserve-3d",
                  }}
                >
                  <div
                    className="relative h-full w-full overflow-hidden transition-transform duration-300 ease-out"
                    style={{
                      borderRadius: parsedRadius,
                      transformStyle: "preserve-3d",
                      transform: isActive
                        ? `rotateX(${interaction.tiltX}deg) rotateY(${interaction.tiltY}deg) translateZ(${
                            interaction.progress ? lift : 0
                          }px)`
                        : "none",
                    }}
                  >
                    <img
                      src={item.imageA}
                      alt={item.title ?? ""}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover"
                      style={{ opacity: 1 - flipProgress }}
                      draggable={false}
                    />

                    {hasDualImage && (
                      <img
                        src={item.imageB}
                        alt=""
                        aria-hidden
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover"
                        style={{ opacity: flipProgress }}
                        draggable={false}
                      />
                    )}

                    {showRibs && (
                      <div
                        className="pointer-events-none absolute inset-0 mix-blend-overlay"
                        style={{
                          backgroundImage:
                            "repeating-linear-gradient(90deg, rgba(255,255,255,0.14) 0px, rgba(0,0,0,0.14) 1px, transparent 2px)",
                          backgroundSize: `${100 / lenticularStrips}% 100%`,
                          opacity: 0.5,
                        }}
                      />
                    )}

                    {showFoil && (
                      <div
                        className="pointer-events-none absolute inset-0 mix-blend-color-dodge transition-opacity duration-300"
                        style={{
                          backgroundImage: FOIL_GRADIENTS[foilVariant],
                          backgroundSize: "220% 220%",
                          backgroundPosition: `${interaction.foilX}% ${interaction.foilY}%`,
                          opacity: foilOpacity,
                        }}
                      />
                    )}

                    {showGrain && (
                      <div
                        className="pointer-events-none absolute inset-0 mix-blend-soft-light"
                        style={{ filter: `url(#${filterId})`, opacity: grainAmount }}
                      />
                    )}

                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

                    <div className="absolute inset-x-0 bottom-0 p-5 text-left">
                      {item.badge && (
                        <span
                          className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide backdrop-blur-md"
                          style={{ color: item.accentColor ?? "#fff" }}
                        >
                          <Sparkles className="h-3 w-3" />
                          {item.badge}
                        </span>
                      )}
                      {item.title && (
                        <h3 className="text-lg font-semibold leading-tight text-white">{item.title}</h3>
                      )}
                      {item.subtitle && (
                        <p className="mt-1 text-sm leading-snug text-white/70">{item.subtitle}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {(showArrows || showDots) && (
          <div className="mt-2 flex items-center justify-center gap-4">
            {showArrows && (
              <button
                type="button"
                onClick={() => changeIndex(currentIndex - 1)}
                disabled={currentIndex === 0}
                aria-label="Previous slide"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-foreground transition-all duration-200 hover:scale-105 hover:bg-muted active:scale-95 disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}

            {showDots && (
              <div className="flex items-center gap-1.5">
                {items.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => changeIndex(i)}
                    aria-label={`Go to slide ${i + 1}`}
                    className={cn(
                      "h-1.5 cursor-pointer rounded-full transition-all duration-300",
                      i === currentIndex ? "w-7 bg-primary" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/60",
                    )}
                  />
                ))}
              </div>
            )}

            {showArrows && (
              <button
                type="button"
                onClick={() => changeIndex(currentIndex + 1)}
                disabled={currentIndex === items.length - 1}
                aria-label="Next slide"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-foreground transition-all duration-200 hover:scale-105 hover:bg-muted active:scale-95 disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  },
);

GrainCarousel.displayName = "GrainCarousel";

export default GrainCarousel;

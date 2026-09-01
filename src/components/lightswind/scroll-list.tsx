import React, { useRef, useEffect, useState } from "react";
import { motion, type Variants } from "motion/react";

import { cn } from "@/lib/utils";

interface ScrollListProps<T> {
  data: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight?: number;
  className?: string;
}

const itemVariants: Variants = {
  hidden: { opacity: 0, scale: 0.7, transition: { duration: 0.35, ease: "easeOut" } },
  focused: { opacity: 1, scale: 1, zIndex: 10, transition: { duration: 0.35, ease: "easeOut" } },
  next: { opacity: 0.75, scale: 0.95, zIndex: 5, transition: { duration: 0.35, ease: "easeOut" } },
  visible: { opacity: 0.45, scale: 0.9, transition: { duration: 0.35, ease: "easeOut" } },
};

function ScrollList<T>({ data, renderItem, itemHeight = 155, className }: ScrollListProps<T>) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  useEffect(() => {
    const listElement = listRef.current;
    if (!listElement) return;

    const updateFocusedItem = () => {
      const children = Array.from(listElement.children) as HTMLDivElement[];
      const scrollTop = listElement.scrollTop;
      const containerCenter = listElement.clientHeight / 2;

      let closestItemIndex = 0;
      let minDistanceToCenter = Infinity;

      children.forEach((child, index) => {
        const itemCenter = child.offsetTop + child.offsetHeight / 2;
        const distanceToCenter = Math.abs(itemCenter - scrollTop - containerCenter);
        if (distanceToCenter < minDistanceToCenter) {
          minDistanceToCenter = distanceToCenter;
          closestItemIndex = index;
        }
      });

      setFocusedIndex(closestItemIndex);
    };

    updateFocusedItem();
    listElement.addEventListener("scroll", updateFocusedItem, { passive: true });
    return () => listElement.removeEventListener("scroll", updateFocusedItem);
  }, [data, itemHeight]);

  return (
    <div
      ref={listRef}
      className={cn(
        "relative flex snap-y snap-mandatory flex-col gap-4 overflow-y-auto scroll-smooth py-[35%] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {data.map((item, index) => {
        let variant: keyof typeof itemVariants = "hidden";
        if (index === focusedIndex) variant = "focused";
        else if (index === focusedIndex + 1) variant = "next";
        else if (Math.abs(index - focusedIndex) <= 2) variant = "visible";

        return (
          <motion.div
            key={index}
            variants={itemVariants}
            initial="hidden"
            animate={variant}
            style={{ minHeight: itemHeight }}
            className="shrink-0 snap-center"
          >
            {renderItem(item, index)}
          </motion.div>
        );
      })}
    </div>
  );
}

export default ScrollList;

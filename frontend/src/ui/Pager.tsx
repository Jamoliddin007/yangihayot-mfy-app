import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { haptic } from "../lib/telegram";

interface PagerProps {
  tabs: string[];
  index: number;
  onIndexChange: (index: number) => void;
  children: ReactNode;
}

// Yuqorida tablar, pastda sahifalar. Sahifalar orasida barmoq bilan chapga/o'ngga surib o'tiladi
// (brauzerning o'z scroll-snap'i — silliq va native), tab bosilganda ham o'tadi.
export function Pager({ tabs, index, onIndexChange, children }: PagerProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(0);
  const indexRef = useRef(index);
  // Tab bosilib dasturiy surilayotganda oraliq sahifalar "tanlangan" deb hisoblanmasligi uchun
  const targetRef = useRef<number | null>(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Tashqaridan (tab bosilganda) index o'zgarsa — o'sha sahifaga suriladi
  useEffect(() => {
    const el = scroller.current;
    if (!el || !width) return;
    if (indexRef.current !== index || Math.round(el.scrollLeft / width) !== index) {
      targetRef.current = index;
      el.scrollTo({ left: index * width, behavior: "smooth" });
    }
    indexRef.current = index;
  }, [index, width]);

  const handleScroll = useCallback(() => {
    const el = scroller.current;
    if (!el || !width) return;
    const progress = el.scrollLeft / width;
    if (indicator.current) indicator.current.style.transform = `translateX(${progress * 100}%)`;
    const nearest = Math.round(progress);
    if (targetRef.current !== null) {
      if (nearest === targetRef.current && Math.abs(progress - nearest) < 0.02) targetRef.current = null;
      return;
    }
    if (nearest !== indexRef.current && Math.abs(progress - nearest) < 0.02) {
      indexRef.current = nearest;
      haptic.select();
      onIndexChange(nearest);
    }
  }, [width, onIndexChange]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav className="relative flex shrink-0 bg-page px-3 pt-1">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            type="button"
            onClick={() => onIndexChange(i)}
            className={`flex-1 py-2.5 text-[15px] font-medium transition-colors ${i === index ? "text-link" : "text-hint"}`}
          >
            {tab}
          </button>
        ))}
        <span className="pointer-events-none absolute bottom-0 left-3 h-[2.5px]" style={{ width: `calc((100% - 24px) / ${tabs.length})` }}>
          <span ref={indicator} className="block h-full w-full rounded-full bg-link" style={{ transform: `translateX(${index * 100}%)` }} />
        </span>
      </nav>
      <div className="h-px shrink-0 bg-line" />
      <div ref={scroller} onScroll={handleScroll} className="pager min-h-0 flex-1">
        {Children.map(children, (child) => (
          <section className="pb-[calc(96px+env(safe-area-inset-bottom))]">{child}</section>
        ))}
      </div>
    </div>
  );
}

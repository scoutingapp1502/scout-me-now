import { useRef, useEffect, useCallback } from "react";

interface TimePickerDrumProps {
  value: string; // "HH:mm"
  onChange: (value: string) => void;
}

const ITEM_H = 44;
const VISIBLE = 5;
const PAD = Math.floor(VISIBLE / 2);

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

function Column({
  items,
  selectedValue,
  onChange,
}: {
  items: string[];
  selectedValue: string;
  onChange: (v: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isScrollingRef.current && listRef.current) {
      const idx = items.indexOf(selectedValue);
      if (idx >= 0) listRef.current.scrollTop = idx * ITEM_H;
    }
  }, [selectedValue, items]);

  const handleScroll = useCallback(() => {
    isScrollingRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      isScrollingRef.current = false;
      if (!listRef.current) return;
      const idx = Math.round(listRef.current.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      onChange(items[clamped]);
    }, 150);
  }, [items, onChange]);

  return (
    <div className="relative flex-1" style={{ height: ITEM_H * VISIBLE }}>
      {/* Selection highlight — no z-index so scroll container (z-[1]) renders on top */}
      <div
        className="absolute inset-x-0 rounded-xl bg-muted pointer-events-none"
        style={{ top: PAD * ITEM_H, height: ITEM_H }}
      />
      {/* Top fade — z-20 so it sits above the scroll container (z-[1]) */}
      <div
        className="absolute inset-x-0 top-0 pointer-events-none z-20 bg-gradient-to-b from-card to-transparent"
        style={{ height: PAD * ITEM_H }}
      />
      {/* Bottom fade */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none z-20 bg-gradient-to-t from-card to-transparent"
        style={{ height: PAD * ITEM_H }}
      />
      {/* Scroll container: z-[1] so it renders above the highlight but below gradients */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="relative z-[1] h-full overflow-y-scroll [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: "y mandatory", scrollbarWidth: "none" }}
      >
        {Array.from({ length: PAD }).map((_, i) => (
          <div key={`t${i}`} style={{ height: ITEM_H, scrollSnapAlign: "center" }} />
        ))}
        {items.map((item) => (
          <div
            key={item}
            style={{ height: ITEM_H, scrollSnapAlign: "center" }}
            className={`flex items-center justify-center text-lg font-body select-none ${
              item === selectedValue ? "text-primary font-semibold" : "text-muted-foreground"
            }`}
          >
            {item}
          </div>
        ))}
        {Array.from({ length: PAD }).map((_, i) => (
          <div key={`b${i}`} style={{ height: ITEM_H, scrollSnapAlign: "center" }} />
        ))}
      </div>
    </div>
  );
}

export default function TimePickerDrum({ value, onChange }: TimePickerDrumProps) {
  const parts = value.split(":");
  const hh = parts[0] ?? "00";
  const mm = parts[1] ?? "00";

  return (
    <div
      className="flex items-center rounded-2xl border border-border bg-card shadow-md overflow-hidden px-2"
      style={{ height: ITEM_H * VISIBLE }}
    >
      <Column items={HOURS} selectedValue={hh} onChange={(h) => onChange(`${h}:${mm}`)} />
      <span className="text-2xl font-bold text-foreground select-none px-1">:</span>
      <Column items={MINUTES} selectedValue={mm} onChange={(m) => onChange(`${hh}:${m}`)} />
    </div>
  );
}

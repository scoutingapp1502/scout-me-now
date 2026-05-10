import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";

const SPORTS_LIST = [
  "Fotbal", "Baschet", "Tenis", "Handbal", "Volei", "Rugby", "Box",
  "Atletism", "Natație", "Ciclism", "Gimnastică", "Judo", "Karate",
  "Taekwondo", "Lupte", "Scrimă", "Haltere", "Tir", "Canotaj",
  "Kayak-Canoe", "Hochei", "Polo", "Baseball", "Softball", "Cricket",
  "Golf", "Badminton", "Tenis de masă", "Patinaj", "Schi", "Snowboard",
  "MMA", "Kickboxing", "Squash", "Padel", "Futsal",
];

export { SPORTS_LIST };

interface SportInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const SportInput = ({ value, onChange, placeholder, className }: SportInputProps) => {
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState(value || "");
  const [filtered, setFiltered] = useState<string[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputText(value || "");
  }, [value]);

  useEffect(() => {
    if (inputText && inputText.length > 0) {
      const lower = inputText.toLowerCase();
      setFiltered(SPORTS_LIST.filter((s) => s.toLowerCase().includes(lower)).slice(0, 8));
    } else {
      setFiltered([]);
    }
  }, [inputText]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        value={inputText}
        onChange={(e) => {
          setInputText(e.target.value);
          setOpen(true);
          if (!e.target.value) onChange("");
        }}
        onFocus={() => inputText && setOpen(true)}
        placeholder={placeholder || "Selectează sportul"}
        className={className}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((sport) => (
            <button
              key={sport}
              type="button"
              onClick={() => {
                onChange(sport);
                setInputText(sport);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent/50 transition-colors"
            >
              {sport}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SportInput;

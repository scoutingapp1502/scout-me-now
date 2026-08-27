import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { normalizeClubName } from "@/hooks/useClubLogos";

interface TeamNameInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
}

const TeamNameInput = ({ value, onChange, suggestions, placeholder, className }: TeamNameInputProps) => {
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState(value || "");
  const [filtered, setFiltered] = useState<string[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputText(value || "");
  }, [value]);

  useEffect(() => {
    if (inputText && inputText.length > 0) {
      const normalized = normalizeClubName(inputText);
      setFiltered(suggestions.filter((s) => normalizeClubName(s).includes(normalized)).slice(0, 8));
    } else {
      setFiltered([]);
    }
  }, [inputText, suggestions]);

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
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => inputText && setOpen(true)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((team) => (
            <button
              key={team}
              type="button"
              onClick={() => {
                onChange(team);
                setInputText(team);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-gray-100 transition-colors"
            >
              {team}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeamNameInput;

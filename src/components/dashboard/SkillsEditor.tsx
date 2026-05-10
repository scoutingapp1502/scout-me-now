import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";

const SUGGESTED_SKILLS = [
  "Analiză video",
  "Scouting tineret",
  "Recruitment",
  "Analiză tactică",
  "Evaluare jucători",
  "Rapoarte de scouting",
  "Negociere transferuri",
  "Dezvoltare talent",
  "Analiză date sportive",
  "Networking",
];

interface SkillsEditorProps {
  skills: string[];
  onChange: (skills: string[]) => void;
  maxSkills?: number;
}

const SkillsEditor = ({ skills, onChange, maxSkills = 5 }: SkillsEditorProps) => {
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);

  const addSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (!trimmed || skills.includes(trimmed) || skills.length >= maxSkills) return;
    onChange([...skills, trimmed]);
    setInputValue("");
  };

  const removeSkill = (index: number) => {
    onChange(skills.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSkill(inputValue);
    }
  };

  const availableSuggestions = SUGGESTED_SKILLS.filter(s => !skills.includes(s));

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        Prezentați-vă aptitudinile de top – adăugați cel mult {maxSkills} aptitudini pentru care doriți să fiți cunoscut(ă). Acestea vor apărea și în secțiunea dvs. Aptitudini.
      </p>

      {/* Current skills as removable chips */}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {skills.map((skill, i) => (
            <span
              key={i}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-sm font-body"
            >
              {skill}
              <button
                type="button"
                onClick={() => removeSkill(i)}
                className="hover:text-destructive transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Aptitudine (ex.: management de proiect)"
          className="bg-muted border-border text-foreground text-sm"
          disabled={skills.length >= maxSkills}
        />
        <button
          type="button"
          onClick={() => addSkill(inputValue)}
          disabled={!inputValue.trim() || skills.length >= maxSkills}
          className="px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <p className="text-xs text-muted-foreground">{skills.length}/{maxSkills}</p>

      {/* Suggestions */}
      {showSuggestions && availableSuggestions.length > 0 && skills.length < maxSkills && (
        <div className="border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground">Sugestie bazată pe profilul dvs.</p>
            <button
              type="button"
              onClick={() => setShowSuggestions(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableSuggestions.slice(0, 6).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => addSkill(suggestion)}
                className="flex items-center gap-1 px-3 py-1.5 border border-border rounded-full text-sm text-foreground hover:bg-accent/50 transition-colors"
              >
                {suggestion}
                <Plus className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SkillsEditor;

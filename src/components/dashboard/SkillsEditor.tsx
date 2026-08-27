import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface SkillsEditorProps {
  skills: string[];
  onChange: (skills: string[]) => void;
  maxSkills?: number;
}

const SkillsEditor = ({ skills, onChange, maxSkills = 5 }: SkillsEditorProps) => {
  const { t } = useLanguage();
  const te = t.dashboard.skillsEditor;
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

  const availableSuggestions = te.suggestions.filter(s => !skills.includes(s));

  return (
    <div className="space-y-3">
      <p className="text-gray-500 text-sm">
        {te.helperTextTemplate.replace("{n}", String(maxSkills))}
      </p>

      {/* Current skills as removable chips */}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {skills.map((skill, i) => (
            <span
              key={i}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-600 border border-orange-200 rounded-full text-sm font-body"
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
          placeholder={te.inputPlaceholder}
          className="bg-gray-100 border-gray-300 text-gray-900 text-sm"
          disabled={skills.length >= maxSkills}
        />
        <button
          type="button"
          onClick={() => addSkill(inputValue)}
          disabled={!inputValue.trim() || skills.length >= maxSkills}
          className="px-3 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <p className="text-xs text-gray-500">{skills.length}/{maxSkills}</p>

      {/* Suggestions */}
      {showSuggestions && availableSuggestions.length > 0 && skills.length < maxSkills && (
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-900">{te.suggestionTitle}</p>
            <button
              type="button"
              onClick={() => setShowSuggestions(false)}
              className="text-gray-500 hover:text-gray-900 transition-colors"
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
                className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-full text-sm text-gray-900 hover:bg-gray-100 transition-colors"
              >
                {suggestion}
                <Plus className="h-3.5 w-3.5 text-gray-500" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SkillsEditor;

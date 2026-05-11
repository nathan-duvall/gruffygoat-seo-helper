import { useState, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface MultiTagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  maxTags?: number;
}

export default function MultiTagInput({ value, onChange, placeholder, maxTags }: MultiTagInputProps) {
  const [input, setInput] = useState("");
  const atMax = maxTags !== undefined && value.length >= maxTags;

  const addTag = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (atMax) return;
    if (value.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setInput("");
      return;
    }
    onChange([...value, trimmed]);
    setInput("");
  };

  const removeTag = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag, i) => (
            <Badge key={`${tag}-${i}`} variant="secondary" className="gap-1 pr-1">
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => removeTag(i)}
                className="rounded-sm hover:bg-muted-foreground/20 p-0.5"
                aria-label={`Remove ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={atMax}
        />
        <Button type="button" variant="outline" onClick={addTag} disabled={atMax || !input.trim()}>
          Add
        </Button>
      </div>
      {maxTags !== undefined && (
        <p className="text-xs text-muted-foreground">{value.length} / {maxTags}</p>
      )}
    </div>
  );
}

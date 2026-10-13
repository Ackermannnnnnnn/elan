"use client";

import { X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { Input } from "./input";

type TagInputProps = {
  id: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Texte du bouton de suppression, ex. « Retirer {tag} ». */
  removeLabel: (tag: string) => string;
  addLabel: string;
  maxItems?: number;
  "aria-describedby"?: string;
};

/**
 * Saisie d'une liste libre (aliments aimés, intolérances…). Entrée ou virgule
 * ajoute l'élément ; le bouton « Ajouter » fait la même chose sur mobile, où la
 * touche Entrée valide souvent le formulaire.
 */
function TagInput({
  id,
  value,
  onChange,
  placeholder,
  removeLabel,
  addLabel,
  maxItems = 50,
  ...props
}: TagInputProps) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const additions = draft
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    if (additions.length === 0) return;
    const known = new Set(value.map((tag) => tag.toLowerCase()));
    const next = [...value];
    for (const tag of additions) {
      if (!known.has(tag.toLowerCase()) && next.length < maxItems) {
        next.push(tag);
        known.add(tag.toLowerCase());
      }
    }
    onChange(next);
    setDraft("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit();
    } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="done"
          aria-describedby={props["aria-describedby"]}
        />
        <button
          type="button"
          onClick={commit}
          disabled={draft.trim() === ""}
          className="h-12 shrink-0 rounded-control border border-border-strong bg-surface px-4 text-[0.9375rem] font-semibold transition-colors hover:bg-surface-muted disabled:opacity-50"
        >
          {addLabel}
        </button>
      </div>
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <li
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-surface-muted py-1 pr-1 pl-3 text-sm font-medium"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter((other) => other !== tag))}
                aria-label={removeLabel(tag)}
                className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-border hover:text-foreground"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export { TagInput };

"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  createContext,
  type ReactNode,
  startTransition,
  useContext,
  useOptimistic,
  useState,
} from "react";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { moveSessionExerciseAction } from "./actions";

type Direction = -1 | 1;

const Order = createContext<{ order: string[]; move: (id: string, direction: Direction) => void }>({
  order: [],
  move: () => {},
});

function reorder(order: string[], id: string, direction: Direction): string[] {
  const from = order.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= order.length) return order;
  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

/**
 * Liste des exercices de la séance, réordonnable : l'exercice monte ou
 * descend tout de suite à l'écran, l'ordre est enregistré en arrière-plan
 * (une seule requête), puis la page se met à jour (supersets, prochain
 * exercice). Les séries, charges et répétitions ne sont pas touchées.
 */
export function ReorderableSessionList({
  items,
}: {
  items: { id: string; className?: string; node: ReactNode }[];
}) {
  const messages = useFormMessages();
  const serverOrder = items.map((item) => item.id);
  const [order, applyMove] = useOptimistic(
    serverOrder,
    (current: string[], change: { id: string; direction: Direction }) =>
      reorder(current, change.id, change.direction),
  );
  const [error, setError] = useState<string | null>(null);
  const byId = new Map(items.map((item) => [item.id, item]));

  const move = (id: string, direction: Direction) => {
    setError(null);
    startTransition(async () => {
      applyMove({ id, direction });
      const result = await moveSessionExerciseAction(id, direction);
      if (!result.ok) setError(result.formError ?? "generic");
    });
  };

  return (
    <Order.Provider value={{ order, move }}>
      {error ? (
        <Alert variant="error" className="mb-3">
          {messages.error(error)}
        </Alert>
      ) : null}
      <ol className="flex flex-col">
        {order.map((id) => {
          const item = byId.get(id);
          return item ? (
            <li key={id} className={item.className}>
              {item.node}
            </li>
          ) : null;
        })}
      </ol>
    </Order.Provider>
  );
}

/** Boutons ▲ ▼ d'un exercice (désactivés aux extrémités de la liste). */
export function MoveButtons({ itemId, name }: { itemId: string; name: string }) {
  const t = useTranslations("Training");
  const { order, move } = useContext(Order);
  const index = order.indexOf(itemId);
  return (
    <div className="flex items-center gap-0.5">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-9 text-muted-foreground"
        disabled={index <= 0}
        onClick={() => move(itemId, -1)}
        aria-label={t("moveUp", { name })}
        title={t("moveUp", { name })}
      >
        <ArrowUp aria-hidden="true" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-9 text-muted-foreground"
        disabled={index < 0 || index >= order.length - 1}
        onClick={() => move(itemId, 1)}
        aria-label={t("moveDown", { name })}
        title={t("moveDown", { name })}
      >
        <ArrowDown aria-hidden="true" />
      </Button>
    </div>
  );
}

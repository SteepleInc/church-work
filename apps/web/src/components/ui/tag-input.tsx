import { Array as EffectArray, Option, pipe, String as EffectString } from "effect";
import { XIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { useEffect, useState } from "react";
import type { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const parseTagOpt = ({ tag, tagValidator }: { tag: string; tagValidator: z.ZodString }) => {
  const parsedTag = tagValidator.safeParse(tag);

  if (parsedTag.success) {
    return pipe(parsedTag.data, Option.some);
  }

  return Option.none();
};

type TagInputProps = Omit<ComponentProps<typeof Input>, "value" | "onChange"> & {
  value?: readonly string[];
  onChange: (value: readonly string[]) => void;
  tagValidator?: z.ZodString;
};

function TagInput({
  className,
  value = [],
  onChange,
  tagValidator,
  onBlur,
  ref,
  ...domProps
}: TagInputProps) {
  const [pendingDataPoint, setPendingDataPoint] = useState("");

  useEffect(() => {
    if (
      pipe(pendingDataPoint, EffectString.includes(",")) ||
      pipe(pendingDataPoint, EffectString.endsWith(" "))
    ) {
      const newDataPoints = new Set([
        ...value,
        ...pipe(
          pendingDataPoint,
          EffectString.split(","),
          EffectArray.filterMap((item) => {
            const trimmedItem = pipe(item, EffectString.trim);

            return pipe(
              tagValidator,
              Option.fromNullable,
              Option.match({
                onNone: () => pipe(trimmedItem, Option.some),
                onSome: (validator) => parseTagOpt({ tag: trimmedItem, tagValidator: validator }),
              }),
            );
          }),
        ),
      ]);

      onChange(Array.from(newDataPoints));
      setPendingDataPoint("");
    }
  }, [pendingDataPoint, onChange, value, tagValidator]);

  const addPendingDataPoint = () => {
    if (!pendingDataPoint) {
      return;
    }

    pipe(
      tagValidator,
      Option.fromNullable,
      Option.match({
        onNone: () => {
          const newDataPoints = new Set([...value, pendingDataPoint]);
          onChange(Array.from(newDataPoints));
          setPendingDataPoint("");
        },
        onSome: (validator) =>
          pipe(
            parseTagOpt({ tag: pendingDataPoint, tagValidator: validator }),
            Option.match({
              onNone: () => undefined,
              onSome: (item) => {
                const newDataPoints = new Set([...value, item]);
                onChange(Array.from(newDataPoints));
                setPendingDataPoint("");
              },
            }),
          ),
      }),
    );
  };

  return (
    <div
      className={cn(
        "flex min-h-10 w-full flex-wrap gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 has-focus-visible:outline-hidden has-focus-visible:ring-2 has-focus-visible:ring-neutral-950 has-focus-visible:ring-offset-2 dark:border-neutral-800 dark:bg-neutral-950 dark:ring-offset-neutral-950 dark:has-focus-visible:ring-neutral-300",
        className,
      )}
    >
      {value.map((item) => (
        <Badge key={item} variant="secondary">
          {item}
          <Button
            aria-label={`Remove ${item}`}
            className="ml-2 size-3"
            onClick={() => onChange(value.filter((existingItem) => existingItem !== item))}
            size="icon"
            type="button"
            variant="ghost"
          >
            <XIcon className="w-3" />
          </Button>
        </Badge>
      ))}
      <input
        className="flex-1 bg-inherit outline-hidden placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
        data-1p-ignore
        onBlur={(event) => {
          addPendingDataPoint();
          onBlur?.(event);
        }}
        onChange={(event) => setPendingDataPoint(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            addPendingDataPoint();
          } else if (
            event.key === "Backspace" &&
            pendingDataPoint.length === 0 &&
            value.length > 0
          ) {
            event.preventDefault();
            onChange(value.slice(0, -1));
          }
        }}
        value={pendingDataPoint}
        {...domProps}
        ref={ref}
      />
    </div>
  );
}

TagInput.displayName = "TagInput";

export { TagInput };

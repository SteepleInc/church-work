import { nullOp } from "@church-task/shared/noOps";
import { Array, Boolean, Option, pipe, String } from "effect";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";

import type { FilterItem } from "@/components/data-table-filter/core/types";
import { SearchIcon } from "@/components/icons/searchIcon";
import { XIcon } from "@/components/icons/xIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { FilterKeys } from "@/shared/global-state";
import { useFilters } from "@/shared/hooks/useFilters";

type CollectionSearchFilterProps<_T> = {
  filterPlaceHolder: string;
  filterColumnId: string;
  className?: string;
  inputClassName?: string;
  filterKey: FilterKeys;
};

export const CollectionSearchFilter = <T,>(props: CollectionSearchFilterProps<T>) => {
  const { filterPlaceHolder, filterColumnId, className, inputClassName, filterKey } = props;

  const [urlFilters, setUrlFilters] = useFilters(filterKey);

  // Get the URL filter value
  const urlFilterValue = pipe(
    urlFilters,
    Array.findFirst((f) => f.columnId === filterColumnId),
    Option.flatMap((f) => pipe(f.values as ReadonlyArray<string | number>, Array.head)),
    Option.map((value) => (typeof value === "string" ? value : "")),
    Option.getOrElse(() => ""),
  );

  // Track if user has started typing (to prevent URL sync from overwriting)
  const hasUserInput = useRef(false);

  // Local input state for immediate feedback
  const [inputValue, setInputValue] = useState(urlFilterValue);

  // Sync from URL to local state only if user hasn't started typing
  // This handles page refresh with query params and hydration
  useEffect(() => {
    if (!hasUserInput.current) {
      setInputValue(urlFilterValue);
    }
  }, [urlFilterValue]);

  // Debounced URL filter update
  const debouncedSetUrlFilters = useDebouncedCallback((value: string) => {
    const textFilter: FilterItem = {
      columnId: filterColumnId,
      operator: "contains",
      type: "text",
      values: [value],
    };

    pipe(
      value,
      String.isNonEmpty,
      Boolean.match({
        onFalse: () =>
          setUrlFilters((x) =>
            pipe(
              x,
              Array.filter((f) => f.columnId !== filterColumnId),
            ),
          ),
        onTrue: () =>
          setUrlFilters((x) =>
            pipe(
              x,
              Array.some((f) => f.columnId === filterColumnId),
              Boolean.match({
                onFalse: () => pipe(x, Array.append(textFilter)),
                onTrue: () =>
                  pipe(
                    x,
                    Array.map((f) => (f.columnId === filterColumnId ? textFilter : f)),
                  ),
              }),
            ),
          ),
      }),
    );
  }, 500);

  // Handle input change - update local state immediately, debounce URL update
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    hasUserInput.current = true;
    const value = e.target.value;
    setInputValue(value);
    debouncedSetUrlFilters(value);
  };

  // Handle clear button - clear both local state and URL filter
  const handleClear = () => {
    setInputValue("");
    debouncedSetUrlFilters.cancel();
    setUrlFilters((x) =>
      pipe(
        x,
        Array.filter((f) => f.columnId !== filterColumnId),
      ),
    );
  };

  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: lib code
    <label
      className={cn(
        "relative flex w-full shrink-1 flex-row items-center gap-2 lg:max-w-64",
        className,
      )}
    >
      <SearchIcon className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
      <Input
        className={cn("flex-1 rounded-full px-9!", inputClassName)}
        onChange={handleChange}
        placeholder={filterPlaceHolder}
        value={inputValue}
      />
      {pipe(
        inputValue,
        String.isNonEmpty,
        Boolean.match({
          onFalse: nullOp,
          onTrue: () => (
            <Button
              aria-label="Clear search"
              className="-translate-y-1/2 absolute top-1/2 right-2 z-10 rounded-full text-muted-foreground"
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleClear();
                }
              }}
              size="icon-xs"
              tabIndex={0}
              type="button"
              variant="ghost"
            >
              <XIcon />
            </Button>
          ),
        }),
      )}
    </label>
  );
};

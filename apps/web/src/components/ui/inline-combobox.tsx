"use client";

import * as React from "react";

import type { PointRef, TElement } from "platejs";

import {
  type ComboboxItemProps,
  Combobox,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxItem,
  ComboboxPopover,
  ComboboxProvider,
  ComboboxRow,
  Portal,
  useComboboxContext,
  useComboboxStore,
} from "@ariakit/react";
import { filterWords } from "@platejs/combobox";
import {
  type UseComboboxInputResult,
  useComboboxInput,
  useHTMLInputCursorState,
} from "@platejs/combobox/react";
import { cva } from "class-variance-authority";
import { useComposedRef, useEditorRef } from "platejs/react";

import { cn } from "@/lib/utils";

type FilterFn = (
  item: { value: string; group?: string; keywords?: string[]; label?: string },
  search: string,
) => boolean;

type InlineComboboxContextValue = {
  filter: FilterFn | false;
  inputProps: UseComboboxInputResult["props"];
  inputRef: React.RefObject<HTMLInputElement | null>;
  removeInput: UseComboboxInputResult["removeInput"];
  showTrigger: boolean;
  trigger: string;
  setHasEmpty: (hasEmpty: boolean) => void;
};

const InlineComboboxContext = React.createContext<InlineComboboxContextValue>(
  null as unknown as InlineComboboxContextValue,
);

const defaultFilter: FilterFn = ({ group, keywords = [], label, value }, search) => {
  const uniqueTerms = new Set([value, ...keywords, group, label].filter(Boolean));

  return Array.from(uniqueTerms).some((keyword) => filterWords(keyword!, search));
};

type InlineComboboxProps = {
  children: React.ReactNode;
  element: TElement;
  trigger: string;
  filter?: FilterFn | false;
  hideWhenNoValue?: boolean;
  showTrigger?: boolean;
  value?: string;
  setValue?: (value: string) => void;
};

const InlineCombobox = ({
  children,
  element,
  filter = defaultFilter,
  hideWhenNoValue = false,
  setValue: setValueProp,
  showTrigger = true,
  trigger,
  value: valueProp,
}: InlineComboboxProps) => {
  const editor = useEditorRef();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const cursorState = useHTMLInputCursorState(inputRef);

  const [valueState, setValueState] = React.useState("");
  const hasValueProp = valueProp !== undefined;
  const value = hasValueProp ? valueProp : valueState;

  const setValue = React.useCallback(
    (newValue: string) => {
      setValueProp?.(newValue);

      if (!hasValueProp) {
        setValueState(newValue);
      }
    },
    [setValueProp, hasValueProp],
  );

  /**
   * Track the point just before the input element so we know where to
   * insertText if the combobox closes due to a selection change.
   */
  const insertPointRef = React.useRef<PointRef | null>(null);

  React.useEffect(() => {
    insertPointRef.current?.unref();
    insertPointRef.current = null;

    const path = editor.api.findPath(element);

    if (!path) return;

    const point = editor.api.before(path);

    if (!point) return;

    const pointRef = editor.api.pointRef(point);
    insertPointRef.current = pointRef;

    return () => {
      if (insertPointRef.current === pointRef) {
        insertPointRef.current = null;
      }
      pointRef.unref();
    };
  }, [editor, element]);

  const { props: inputProps, removeInput } = useComboboxInput({
    cancelInputOnBlur: true,
    cursorState,
    ref: inputRef,
    onCancelInput: (cause) => {
      if (cause !== "backspace") {
        editor.tf.insertText(trigger + value, {
          at: insertPointRef.current?.current ?? undefined,
        });
      }
      if (cause === "arrowLeft" || cause === "arrowRight") {
        editor.tf.move({
          distance: 1,
          reverse: cause === "arrowLeft",
        });
      }
    },
  });

  const [hasEmpty, setHasEmpty] = React.useState(false);

  const contextValue: InlineComboboxContextValue = React.useMemo(
    () => ({
      filter,
      inputProps,
      inputRef,
      removeInput,
      setHasEmpty,
      showTrigger,
      trigger,
    }),
    [trigger, showTrigger, filter, inputRef, inputProps, removeInput, setHasEmpty],
  );

  const store = useComboboxStore({
    // Anchor the popover's left edge to the trigger (Linear behavior) instead of
    // centering it, which pushed the menu left of the caret and clipped it
    // against the details pane's edge.
    placement: "bottom-start",
    setValue: (newValue) => React.startTransition(() => setValue(newValue)),
  });

  const items = store.useState("items");

  /**
   * If there is no active ID and the list of items changes, select the first
   * item.
   */
  React.useEffect(() => {
    if (!store.getState().activeId) {
      store.setActiveId(store.first());
    }
  }, [items, store]);

  return (
    <span contentEditable={false}>
      <ComboboxProvider
        open={(items.length > 0 || hasEmpty) && (!hideWhenNoValue || value.length > 0)}
        store={store}
      >
        <InlineComboboxContext.Provider value={contextValue}>
          {children}
        </InlineComboboxContext.Provider>
      </ComboboxProvider>
    </span>
  );
};

const InlineComboboxInput = ({
  className,
  ref: propRef,
  ...props
}: React.HTMLAttributes<HTMLInputElement> & {
  ref?: React.RefObject<HTMLInputElement | null>;
}) => {
  const {
    inputProps,
    inputRef: contextRef,
    showTrigger,
    trigger,
  } = React.useContext(InlineComboboxContext);

  const store = useComboboxContext()!;
  const value = store.useState("value");

  const ref = useComposedRef(propRef, contextRef);

  /**
   * To create an auto-resizing input, we render a visually hidden span
   * containing the input value and position the input element on top of it.
   * This works well for all cases except when input exceeds the width of the
   * container.
   */

  return (
    <>
      {showTrigger && trigger}

      <span className="relative min-h-[1lh]">
        <span className="invisible overflow-hidden text-nowrap" aria-hidden="true">
          {value || "\u200B"}
        </span>

        <Combobox
          ref={ref}
          className={cn("absolute top-0 left-0 size-full bg-transparent outline-none", className)}
          value={value}
          autoSelect
          {...inputProps}
          {...props}
        />
      </span>
    </>
  );
};

InlineComboboxInput.displayName = "InlineComboboxInput";

const InlineComboboxContent: typeof ComboboxPopover = ({ className, ...props }) => {
  // Portal prevents CSS from leaking into popover
  const store = useComboboxContext();

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!store) return;

    const state = store.getState();
    const { items, activeId } = state;

    if (!items.length) return;

    const currentIndex = items.findIndex((item) => item.id === activeId);

    if (event.key === "ArrowUp" && currentIndex <= 0) {
      event.preventDefault();
      store.setActiveId(store.last());
    } else if (event.key === "ArrowDown" && currentIndex >= items.length - 1) {
      event.preventDefault();
      store.setActiveId(store.first());
    }
  }

  return (
    <Portal>
      <ComboboxPopover
        // Float clear of the trigger, flip above the caret when there's no room
        // below, and shift to stay on-screen. `--popover-available-height` caps
        // the height to the space left in the viewport so the list never spills
        // past the fold (the `max-h-[288px]` keeps it compact when there is room).
        flip
        gutter={4}
        shift={0}
        // Anchor to the whole trigger chip (the `@`/`/` glyph + input) rather
        // than the bare input, so a `bottom-start` menu lines up under the glyph
        // instead of starting to its right. Ariakit passes the combobox input as
        // `anchor`; we walk up to its chip wrapper, falling back to the store's
        // base element and finally the input itself.
        getAnchorRect={(anchor) => {
          const base = (anchor ?? store?.getState().baseElement ?? null) as HTMLElement | null;
          const chip = base?.closest<HTMLElement>("[data-combobox-anchor]") ?? null;
          return (chip ?? base)?.getBoundingClientRect() ?? null;
        }}
        className={cn(
          "z-500 max-h-[min(288px,var(--popover-available-height))] w-[300px] overflow-y-auto rounded-md border bg-popover shadow-md",
          className,
        )}
        onKeyDownCapture={handleKeyDown}
        {...props}
      />
    </Portal>
  );
};

const comboboxItemVariants = cva(
  "relative mx-1 flex h-[28px] select-none items-center rounded-sm px-2 text-foreground text-sm outline-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    defaultVariants: {
      interactive: true,
    },
    variants: {
      interactive: {
        false: "",
        true: "cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground data-[active-item=true]:bg-accent data-[active-item=true]:text-accent-foreground",
      },
    },
  },
);

const InlineComboboxItem = ({
  className,
  focusEditor = true,
  group,
  keywords,
  label,
  onClick,
  ...props
}: {
  focusEditor?: boolean;
  group?: string;
  keywords?: string[];
  label?: string;
} & ComboboxItemProps &
  Required<Pick<ComboboxItemProps, "value">>) => {
  const { value } = props;

  const { filter, removeInput } = React.useContext(InlineComboboxContext);

  const store = useComboboxContext()!;

  // Optimization: Do not subscribe to value if filter is false
  const search = filter && store.useState("value");

  const visible = React.useMemo(
    () => !filter || filter({ group, keywords, label, value }, search as string),
    [filter, group, keywords, label, value, search],
  );

  if (!visible) return null;

  return (
    <ComboboxItem
      className={cn(comboboxItemVariants(), className)}
      onClick={(event) => {
        removeInput(focusEditor);
        onClick?.(event);
      }}
      {...props}
    />
  );
};

const InlineComboboxEmpty = ({ children, className }: React.HTMLAttributes<HTMLDivElement>) => {
  const { setHasEmpty } = React.useContext(InlineComboboxContext);
  const store = useComboboxContext()!;
  const items = store.useState("items");

  React.useEffect(() => {
    setHasEmpty(true);

    return () => {
      setHasEmpty(false);
    };
  }, [setHasEmpty]);

  if (items.length > 0) return null;

  return (
    <div className={cn(comboboxItemVariants({ interactive: false }), className)}>{children}</div>
  );
};

const InlineComboboxRow = ComboboxRow;

const InlineComboboxGroup = ({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxGroup>) => (
  <ComboboxGroup
    className={cn("hidden py-1.5 not-last:border-b [&:has([role=option])]:block", className)}
    {...props}
  />
);

const InlineComboboxGroupLabel = ({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxGroupLabel>) => (
  <ComboboxGroupLabel
    className={cn("mt-1.5 mb-2 px-3 font-medium text-muted-foreground text-xs", className)}
    {...props}
  />
);

export {
  InlineCombobox,
  InlineComboboxContent,
  InlineComboboxEmpty,
  InlineComboboxGroup,
  InlineComboboxGroupLabel,
  InlineComboboxInput,
  InlineComboboxItem,
  InlineComboboxRow,
};

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { motion } from "motion/react";
import {
  Children,
  type ComponentProps,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

type PageTabsProps = TabsPrimitive.Root.Props & {
  readonly storageKey?: string;
};

type PageTabsListProps = TabsPrimitive.List.Props & {
  readonly activeValue?: string;
  readonly children: ReactNode;
};

function isTabTriggerElement(child: ReactNode): child is ReactElement<{ value: string }> {
  return (
    isValidElement(child) &&
    child.props !== null &&
    typeof child.props === "object" &&
    "value" in child.props
  );
}

function PageTabs({
  children,
  className,
  defaultValue,
  onValueChange,
  storageKey: _storageKey,
  value,
  ...props
}: PageTabsProps) {
  const [activeValue, setActiveValue] = useState<string | undefined>(value ?? defaultValue);

  const handleValueChange: NonNullable<TabsPrimitive.Root.Props["onValueChange"]> = (
    nextValue,
    eventDetails,
  ) => {
    setActiveValue(nextValue);
    onValueChange?.(nextValue, eventDetails);
  };

  const selectedValue = value ?? activeValue;

  return (
    <TabsPrimitive.Root
      className={cn("relative flex flex-col gap-0", className)}
      data-slot="tabs"
      defaultValue={defaultValue}
      onValueChange={handleValueChange}
      value={selectedValue}
      {...props}
    >
      {Children.map(children, (child) =>
        isValidElement(child) && child.type === PageTabsList
          ? cloneElement(child as ReactElement<PageTabsListProps>, {
              activeValue: selectedValue,
            })
          : child,
      )}
    </TabsPrimitive.Root>
  );
}

function PageTabsList({ activeValue, children, className, ...props }: PageTabsListProps) {
  const [activePosition, setActivePosition] = useState<{ width: number; x: number } | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const layoutId = useId();

  const calculatePosition = (index: number) => {
    const tab = tabRefs.current[index];
    if (!tab) return { width: 0, x: 0 };

    const rect = tab.getBoundingClientRect();
    const containerLeft = tabRefs.current[0]?.getBoundingClientRect().left ?? 0;
    return { width: rect.width, x: rect.left - containerLeft };
  };

  useLayoutEffect(() => {
    const childArray = Children.toArray(children);
    const index = childArray.findIndex(
      (child) => isTabTriggerElement(child) && child.props.value === activeValue,
    );

    if (index >= 0) {
      setActivePosition(calculatePosition(index));
    }
  }, [activeValue, children]);

  return (
    <TabsPrimitive.List
      className={cn(
        "relative flex h-14 items-center gap-0 border-zinc-200 border-b bg-transparent px-0 dark:border-zinc-700",
        className,
      )}
      data-slot="tabs-list"
      {...props}
    >
      {Children.toArray(children)
        .filter(isValidElement)
        .map((child, index) =>
          cloneElement(child as ReactElement<ComponentProps<typeof PageTabsTrigger>>, {
            key: child.key ?? index,
            onMouseEnter: () => setHoverIndex(index),
            onMouseLeave: () => setHoverIndex(null),
            ref: (element: HTMLButtonElement | null) => {
              tabRefs.current[index] = element;
            },
          }),
        )}

      {hoverIndex !== null ? (
        <motion.div
          animate={calculatePosition(hoverIndex)}
          className="absolute top-1/2 h-8 -translate-y-1/2 rounded-[4px] bg-muted-foreground/10 px-1"
          initial={false}
          layoutId={`hoverHighlight-${layoutId}`}
          transition={{ damping: 25, mass: 0.3, stiffness: 300, type: "spring" }}
        />
      ) : null}

      {activePosition ? (
        <motion.div
          animate={activePosition}
          className="absolute bottom-0 h-1 rounded-t-md bg-foreground dark:bg-foreground"
          initial={activePosition}
          layoutId={`activeUnderline-${layoutId}`}
          transition={{ damping: 25, mass: 0.3, stiffness: 300, type: "spring" }}
        />
      ) : null}
    </TabsPrimitive.List>
  );
}

function PageTabsTrigger({ className, value, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      className={cn(
        "relative z-20 flex items-center justify-center rounded-md px-3 py-2 font-medium text-muted-foreground text-sm transition-colors duration-300 ease-in-out hover:text-foreground data-active:text-foreground",
        className,
      )}
      data-slot="tabs-trigger"
      value={value}
      {...props}
    />
  );
}

function PageTabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel className={cn("p-4", className)} data-slot="tabs-content" {...props} />
  );
}

export { PageTabs, PageTabsList, PageTabsTrigger, PageTabsContent };

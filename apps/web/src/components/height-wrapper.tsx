import type { FC, HTMLProps } from "react";

import { cn } from "@/lib/utils";

export const HEIGHT_WRAPPER_ID = "height-wrapper";

export const HeightWrapper: FC<HTMLProps<HTMLDivElement>> = (props) => {
  const { children, className, ...domProps } = props;

  return (
    <div
      className={cn(
        "flex flex-col bg-background font-sans! text-foreground transition-[background-color] duration-500",
        className,
      )}
      data-wrapper=""
      id={HEIGHT_WRAPPER_ID}
      style={{ height: "100svh" }}
      {...domProps}
    >
      {children}
    </div>
  );
};

import { Copy01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type CopyableValueProps = {
  readonly value: string;
};

function CopyableValue({ value }: CopyableValueProps) {
  return (
    <span className="group/copyable flex w-full min-w-0 items-center justify-between gap-1 overflow-hidden">
      <span className="min-w-0 truncate">{value}</span>
      <Button
        className="-mr-8 size-6 shrink-0 opacity-0 transition-all duration-200 group-hover/copyable:mr-0 group-hover/copyable:opacity-100"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          toast.success("Copied to clipboard.");
        }}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <HugeiconsIcon className="size-3.5" icon={Copy01Icon} strokeWidth={2} />
        <span className="sr-only">Copy {value}</span>
      </Button>
    </span>
  );
}

type DevMenuContentProps = {
  readonly orgId: string;
  readonly userId: string;
};

export function DevMenuContent({ orgId, userId }: DevMenuContentProps) {
  return (
    <div className="mb-2 flex flex-col gap-2 overflow-hidden text-muted-foreground/40 text-sm">
      <CopyableValue value={orgId} />
      <CopyableValue value={userId} />
    </div>
  );
}

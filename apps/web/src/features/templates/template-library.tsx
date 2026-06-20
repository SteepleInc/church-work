import type { LinkProps } from "@tanstack/react-router";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CalendarClock, Copy, LibraryBig, MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { MainContainer, PageContainer } from "@/components/pageComponents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PageTabs, PageTabsList, PageTabsTrigger } from "@/components/ui/page-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import {
  formatTemplateScheduleOccurrence,
  useDuplicateTemplateAction,
  useTemplateSchedulesCollection,
  useTemplatesCollection,
} from "@/data/templates/templatesData.app";
import { SettingsKeyDatesPanel } from "@/features/settings/key-date-settings";
import { TemplatesCollection } from "@/features/templates/templates-collection";
import {
  canManageTemplates,
  DeleteScheduleDialog,
  DeleteTemplateDialog,
  useTemplateSoftDelete,
} from "@/features/templates/template-soft-delete";

import type {
  TemplateCollectionItem,
  TemplateScheduleCollectionItem,
} from "@/data/templates/templatesData.app";

export type TemplateLibraryTab = "schedules" | "library" | "key-dates";

type TabConfig = {
  readonly label: string;
  readonly to: LinkProps["to"];
  readonly value: TemplateLibraryTab;
};

const TEMPLATE_TABS: readonly TabConfig[] = [
  { label: "Templates", to: "/templates", value: "schedules" },
  { label: "Library", to: "/templates/library", value: "library" },
  { label: "Key Dates", to: "/templates/key-dates", value: "key-dates" },
];

const TAB_DESCRIPTION: Record<TemplateLibraryTab, string> = {
  "key-dates":
    "Named dates with planning significance — Easter, Christmas, a church anniversary. Templates can schedule work around them.",
  library: "Every saved Template for this Church, including ones that aren't scheduled yet.",
  schedules: "Active Template Schedules projecting recurring Church work into upcoming Weeks.",
};

const PAGE_DESCRIPTION =
  "Reusable Templates, their Schedules, and the Key Dates they plan around for this Church.";

export function TemplatesPage({ tab }: { readonly tab: TemplateLibraryTab }) {
  const { currentOrgOpt: activeChurch, loading: orgLoading } = useCurrentOrgOpt();
  const churchId = activeChurch?.id ?? null;
  const templates = useTemplatesCollection({ churchId });
  const schedules = useTemplateSchedulesCollection({ churchId });
  const templatesLoading = orgLoading || templates.loading || schedules.loading;

  const canManage = activeChurch ? canManageTemplates(activeChurch.role) : false;

  const header = (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl tracking-tight">Templates</h1>
        <p className="max-w-3xl text-balance text-muted-foreground text-sm">{PAGE_DESCRIPTION}</p>
      </div>

      <PageTabs className="gap-6" value={tab}>
        <PageTabsList aria-label="Template sections" className="h-10">
          {TEMPLATE_TABS.map((entry) => (
            <PageTabsTrigger
              key={entry.value}
              render={<Link preload="intent" replace to={entry.to} />}
              value={entry.value}
            >
              {entry.label}
            </PageTabsTrigger>
          ))}
        </PageTabsList>
      </PageTabs>
    </>
  );

  // The Templates tab hosts the generic Collection, which owns its own scroll
  // and grows to fill the viewport — so it renders outside the page ScrollArea.
  if (tab === "schedules") {
    return (
      <MainContainer>
        <div className="flex flex-col gap-6 px-4 pt-0 md:pt-1">{header}</div>
        <TemplatesCollection />
      </MainContainer>
    );
  }

  const renderCurrentTab = () => {
    switch (tab) {
      case "library":
        return (
          <TemplateLibraryPanel
            canManage={canManage}
            churchId={churchId}
            description={TAB_DESCRIPTION.library}
            loading={templatesLoading}
            templates={templates.templatesCollection}
          />
        );
      case "key-dates":
        return <SettingsKeyDatesPanel embedded />;
    }
  };

  return (
    <MainContainer>
      <PageContainer wrapperClassName="gap-6">
        {header}
        {renderCurrentTab()}
      </PageContainer>
    </MainContainer>
  );
}

function TemplateLibraryPanel({
  canManage,
  churchId,
  description,
  loading,
  templates,
}: {
  readonly canManage: boolean;
  readonly churchId: string | null;
  readonly description: string;
  readonly loading: boolean;
  readonly templates: readonly TemplateCollectionItem[];
}) {
  const duplicateTemplate = useDuplicateTemplateAction();
  const { removeTemplate } = useTemplateSoftDelete();
  const [pendingTemplate, setPendingTemplate] = useState<TemplateCollectionItem | null>(null);
  const onDuplicateTemplate = async (template: TemplateCollectionItem) => {
    if (!churchId) return;
    const result = await duplicateTemplate({ churchId, templateId: template.id });
    if (result.ok) {
      toast.success(`${template.name} duplicated`);
    } else {
      toast.error(result.error.message);
    }
  };
  const confirmDeleteTemplate = () => {
    if (!churchId || !pendingTemplate) {
      return Promise.resolve({ error: { message: "Select a Template to delete." }, ok: false });
    }
    return removeTemplate({ churchId, id: pendingTemplate.id, name: pendingTemplate.name });
  };

  if (loading) return <TemplateCardSkeleton />;
  if (templates.length === 0) {
    return (
      <Empty className="min-h-64 rounded-xl border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LibraryBig />
          </EmptyMedia>
          <EmptyTitle>No Templates yet</EmptyTitle>
          <EmptyDescription>
            Saved Templates, including unscheduled ones, will appear here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">{description}</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <div
            className="group relative flex flex-col rounded-xl border bg-card transition-colors hover:border-foreground/20 hover:bg-muted/40"
            key={template.id}
          >
            <Link
              className="flex flex-col gap-3 p-4 outline-none"
              params={{ templateId: template.id }}
              to="/templates/$templateId"
            >
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:text-foreground">
                <LibraryBig className="size-4" />
              </div>
              <div className="min-w-0 pr-6">
                <h2 className="truncate font-medium">{template.name}</h2>
                <p className="text-muted-foreground text-sm">
                  {formatTemplateCardSummary(template)}
                </p>
              </div>
            </Link>
            {canManage ? (
              <div className="absolute top-3 right-3">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        aria-label={`Template actions for ${template.name}`}
                        className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
                        size="icon-sm"
                        variant="ghost"
                      />
                    }
                  >
                    <MoreHorizontal />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="bottom">
                    <DropdownMenuItem onClick={() => void onDuplicateTemplate(template)}>
                      <Copy />
                      Duplicate Template
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setPendingTemplate(template)}
                      variant="destructive"
                    >
                      <Trash2 />
                      Delete Template
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <DeleteTemplateDialog
        onConfirm={confirmDeleteTemplate}
        onOpenChange={(open) => {
          if (!open) setPendingTemplate(null);
        }}
        open={pendingTemplate !== null}
        scheduleCount={pendingTemplate?.scheduleCount ?? 0}
        templateName={pendingTemplate?.name ?? ""}
      />
    </div>
  );
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatTemplateCardSummary(template: TemplateCollectionItem) {
  const scheduleSummary =
    template.scheduleCount === 0 ? "Unscheduled" : formatCount(template.scheduleCount, "schedule");

  return `${scheduleSummary} · ${formatCount(template.taskCount, "task")}`;
}

export function TemplateDetailPage({ templateId }: { readonly templateId: string }) {
  const navigate = useNavigate();
  const { currentOrgOpt: activeChurch, loading: orgLoading } = useCurrentOrgOpt();
  const churchId = activeChurch?.id ?? null;
  const canManage = activeChurch ? canManageTemplates(activeChurch.role) : false;
  const templates = useTemplatesCollection({ churchId });
  const schedules = useTemplateSchedulesCollection({ churchId });
  const template = templates.templatesCollection.find((item) => item.id === templateId);
  const templateSchedules = schedules.templateSchedulesCollection.filter(
    (item) => item.templateId === templateId,
  );
  const loading = orgLoading || templates.loading || schedules.loading;

  const duplicateTemplate = useDuplicateTemplateAction();
  const { removeSchedule, removeTemplate } = useTemplateSoftDelete();
  const [deleteTemplateOpen, setDeleteTemplateOpen] = useState(false);
  const [pendingSchedule, setPendingSchedule] = useState<TemplateScheduleCollectionItem | null>(
    null,
  );
  const confirmDeleteSchedule = (cleanupCurrentOccurrence: boolean) => {
    if (!churchId || !pendingSchedule) {
      return Promise.resolve({ error: { message: "Select a Schedule to delete." }, ok: false });
    }
    return removeSchedule({ churchId, cleanupCurrentOccurrence, schedule: pendingSchedule });
  };
  const onDuplicateTemplate = async () => {
    if (!churchId || !template) return;
    const result = await duplicateTemplate({ churchId, templateId: template.id });
    if (result.ok) {
      toast.success(`${template.name} duplicated`);
      await navigate({ to: "/templates/library" });
    } else {
      toast.error(result.error.message);
    }
  };

  return (
    <MainContainer>
      <PageContainer wrapperClassName="gap-6">
        <Button
          className="-ml-2 w-fit text-muted-foreground"
          render={<Link to="/templates/library" />}
          size="sm"
          variant="ghost"
        >
          <ArrowLeft />
          Templates
        </Button>
        {loading ? (
          <TemplateDetailSkeleton />
        ) : !template ? (
          <Empty className="min-h-64 rounded-xl border bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LibraryBig />
              </EmptyMedia>
              <EmptyTitle>Template not found</EmptyTitle>
              <EmptyDescription>
                This Template may have been deleted or belongs to another Church.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h1 className="font-semibold text-2xl tracking-tight">{template.name}</h1>
                <p className="text-muted-foreground text-sm">
                  {template.scheduleCount} schedule{template.scheduleCount === 1 ? "" : "s"} ·{" "}
                  {template.taskCount} task{template.taskCount === 1 ? "" : "s"}
                </p>
              </div>
              {canManage ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        aria-label={`Template actions for ${template.name}`}
                        className="text-muted-foreground"
                        size="icon-sm"
                        variant="ghost"
                      />
                    }
                  >
                    <MoreHorizontal />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="bottom">
                    <DropdownMenuItem onClick={() => void onDuplicateTemplate()}>
                      <Copy />
                      Duplicate Template
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDeleteTemplateOpen(true)}
                      variant="destructive"
                    >
                      <Trash2 />
                      Delete Template
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
            <section className="rounded-xl border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <CalendarClock className="size-4 text-muted-foreground" />
                <h2 className="font-medium">Template Schedules</h2>
              </div>
              {templateSchedules.length === 0 ? (
                <p className="text-muted-foreground text-sm">This Template is saved unscheduled.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {templateSchedules.map((schedule) => (
                    <div
                      className="group flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                      key={schedule.id}
                    >
                      <span className="truncate font-medium text-sm">{schedule.name}</span>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <Badge variant="secondary">{schedule.kindLabel}</Badge>
                        <span className="text-muted-foreground text-sm tabular-nums">
                          {formatTemplateScheduleOccurrence(schedule.nextOccurrence)}
                        </span>
                        {canManage ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  aria-label={`Schedule actions for ${schedule.name}`}
                                  className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
                                  size="icon-sm"
                                  variant="ghost"
                                />
                              }
                            >
                              <MoreHorizontal />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" side="bottom">
                              <DropdownMenuItem
                                onClick={() => setPendingSchedule(schedule)}
                                variant="destructive"
                              >
                                <Trash2 />
                                Stop Schedule
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="rounded-xl border bg-card p-4">
              <h2 className="mb-1 font-medium">Usage and occurrence history</h2>
              <p className="text-muted-foreground text-sm">
                Occurrence history summaries will appear here as scheduling and materialization
                slices land.
              </p>
            </section>

            <DeleteTemplateDialog
              onConfirm={async () => {
                if (!churchId) {
                  return {
                    error: { message: "Select a Church before deleting a Template." },
                    ok: false,
                  };
                }
                const result = await removeTemplate({
                  churchId,
                  id: template.id,
                  name: template.name,
                });
                if (result.ok) {
                  await navigate({ to: "/templates/library" });
                }
                return result;
              }}
              onOpenChange={setDeleteTemplateOpen}
              open={deleteTemplateOpen}
              scheduleCount={template.scheduleCount}
              templateName={template.name}
            />

            <DeleteScheduleDialog
              onConfirm={confirmDeleteSchedule}
              onOpenChange={(open) => {
                if (!open) setPendingSchedule(null);
              }}
              open={pendingSchedule !== null}
              schedule={pendingSchedule}
            />
          </>
        )}
      </PageContainer>
    </MainContainer>
  );
}

function TemplateCardSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4" key={item}>
          <Skeleton className="size-9 rounded-lg" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3.5 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TemplateDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
    </div>
  );
}

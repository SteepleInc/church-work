import type { LinkProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarClock, LibraryBig } from "lucide-react";

import { MainContainer, PageContainer } from "@/components/pageComponents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PageTabs, PageTabsList, PageTabsTrigger } from "@/components/ui/page-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import {
  formatTemplateScheduleOccurrence,
  useTemplateSchedulesCollection,
  useTemplatesCollection,
} from "@/data/templates/templatesData.app";
import { SettingsKeyDatesPanel } from "@/features/settings/key-date-settings";

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
  { label: "Schedules", to: "/templates", value: "schedules" },
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

  const renderCurrentTab = () => {
    switch (tab) {
      case "schedules":
        return (
          <TemplateSchedulesPanel
            description={TAB_DESCRIPTION.schedules}
            loading={templatesLoading}
            schedules={schedules.templateSchedulesCollection}
          />
        );
      case "library":
        return (
          <TemplateLibraryPanel
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

        {renderCurrentTab()}
      </PageContainer>
    </MainContainer>
  );
}

function TemplateSchedulesPanel({
  description,
  loading,
  schedules,
}: {
  readonly description: string;
  readonly loading: boolean;
  readonly schedules: readonly TemplateScheduleCollectionItem[];
}) {
  if (loading) return <TemplateListSkeleton />;
  if (schedules.length === 0) {
    return (
      <Empty className="min-h-64 rounded-xl border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarClock />
          </EmptyMedia>
          <EmptyTitle>No Template Schedules yet</EmptyTitle>
          <EmptyDescription>
            Schedule a Template to project its recurring work into upcoming Weeks.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">{description}</p>
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader className="bg-card">
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Schedule</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead className="pr-4 text-right">Next occurrence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.map((schedule) => (
              <TableRow key={schedule.id}>
                <TableCell className="pl-4 font-medium">{schedule.name}</TableCell>
                <TableCell>
                  <Link
                    className="text-muted-foreground transition-colors hover:text-foreground hover:underline"
                    params={{ templateId: schedule.templateId }}
                    to="/templates/$templateId"
                  >
                    {schedule.templateName}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{schedule.kindLabel}</Badge>
                </TableCell>
                <TableCell className="pr-4 text-right text-muted-foreground tabular-nums">
                  {formatTemplateScheduleOccurrence(schedule.nextOccurrence)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function TemplateLibraryPanel({
  description,
  loading,
  templates,
}: {
  readonly description: string;
  readonly loading: boolean;
  readonly templates: readonly TemplateCollectionItem[];
}) {
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
          <Link
            className="group flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20 hover:bg-muted/40"
            key={template.id}
            params={{ templateId: template.id }}
            to="/templates/$templateId"
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:text-foreground">
              <LibraryBig className="size-4" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-medium">{template.name}</h2>
              <p className="text-muted-foreground text-sm">{formatTemplateCardSummary(template)}</p>
            </div>
          </Link>
        ))}
      </div>
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
  const { currentOrgOpt: activeChurch, loading: orgLoading } = useCurrentOrgOpt();
  const templates = useTemplatesCollection({ churchId: activeChurch?.id ?? null });
  const schedules = useTemplateSchedulesCollection({ churchId: activeChurch?.id ?? null });
  const template = templates.templatesCollection.find((item) => item.id === templateId);
  const templateSchedules = schedules.templateSchedulesCollection.filter(
    (item) => item.templateId === templateId,
  );
  const loading = orgLoading || templates.loading || schedules.loading;
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
            <div className="flex flex-col gap-1">
              <h1 className="font-semibold text-2xl tracking-tight">{template.name}</h1>
              <p className="text-muted-foreground text-sm">
                {template.scheduleCount} schedule{template.scheduleCount === 1 ? "" : "s"} ·{" "}
                {template.taskCount} task{template.taskCount === 1 ? "" : "s"}
              </p>
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
                      className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                      key={schedule.id}
                    >
                      <span className="truncate font-medium text-sm">{schedule.name}</span>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <Badge variant="secondary">{schedule.kindLabel}</Badge>
                        <span className="text-muted-foreground text-sm tabular-nums">
                          {formatTemplateScheduleOccurrence(schedule.nextOccurrence)}
                        </span>
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
          </>
        )}
      </PageContainer>
    </MainContainer>
  );
}

function TemplateListSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex h-10 items-center border-b px-4">
        <Skeleton className="h-3.5 w-24" />
      </div>
      {[0, 1, 2, 3].map((item) => (
        <div className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0" key={item}>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="ml-auto h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
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

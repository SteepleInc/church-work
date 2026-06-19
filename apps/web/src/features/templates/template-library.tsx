import { Link } from "@tanstack/react-router";
import { CalendarClock, LibraryBig, MoreHorizontal } from "lucide-react";

import { MainContainer, PageContainer } from "@/components/pageComponents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
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

export function TemplatesPage({ tab }: { readonly tab: TemplateLibraryTab }) {
  const { currentOrgOpt: activeChurch, loading: orgLoading } = useCurrentOrgOpt();
  const churchId = activeChurch?.id ?? null;
  const templates = useTemplatesCollection({ churchId });
  const schedules = useTemplateSchedulesCollection({ churchId });
  const loading = orgLoading || templates.loading || schedules.loading;

  return (
    <MainContainer>
      <PageContainer wrapperClassName="gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-semibold text-2xl tracking-tight">Templates</h1>
          <p className="max-w-3xl text-muted-foreground text-sm">
            Reusable planning templates, active schedules, and calendar dates that drive Church
            work.
          </p>
        </div>
        <div className="inline-flex h-8 w-fit items-center rounded-lg bg-muted p-[3px] text-muted-foreground">
          <TemplateTabLink active={tab === "schedules"} to="/templates">
            Schedules
          </TemplateTabLink>
          <TemplateTabLink active={tab === "library"} to="/templates/library">
            Library
          </TemplateTabLink>
          <TemplateTabLink active={tab === "key-dates"} to="/templates/key-dates">
            Key Dates
          </TemplateTabLink>
        </div>
        {tab === "schedules" ? (
          <TemplateSchedulesPanel
            loading={loading}
            schedules={schedules.templateSchedulesCollection}
          />
        ) : tab === "library" ? (
          <TemplateLibraryPanel loading={loading} templates={templates.templatesCollection} />
        ) : (
          <SettingsKeyDatesPanel />
        )}
      </PageContainer>
    </MainContainer>
  );
}

function TemplateTabLink({
  active,
  children,
  to,
}: {
  readonly active: boolean;
  readonly children: string;
  readonly to: "/templates" | "/templates/library" | "/templates/key-dates";
}) {
  return (
    <Link
      className={
        active
          ? "inline-flex h-full items-center rounded-md bg-background px-2 text-sm font-medium text-foreground shadow-sm"
          : "inline-flex h-full items-center rounded-md px-2 text-foreground/60 text-sm font-medium hover:text-foreground"
      }
      to={to}
    >
      {children}
    </Link>
  );
}

function TemplateSchedulesPanel({
  loading,
  schedules,
}: {
  readonly loading: boolean;
  readonly schedules: readonly TemplateScheduleCollectionItem[];
}) {
  if (loading) return <TemplateListSkeleton />;
  if (schedules.length === 0) {
    return (
      <Empty className="min-h-64 rounded-xl border bg-card">
        <EmptyHeader>
          <EmptyTitle>No Template Schedules yet</EmptyTitle>
          <EmptyDescription>
            Create schedules later to project recurring Church work into Weeks.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="grid grid-cols-[1.5fr_1.2fr_.8fr_1fr_1fr_auto] gap-3 border-b px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
        <span>Schedule</span>
        <span>Template</span>
        <span>Kind</span>
        <span>Next occurrence</span>
        <span>Recent usage</span>
        <span>Actions</span>
      </div>
      {schedules.map((schedule) => (
        <div
          className="grid grid-cols-[1.5fr_1.2fr_.8fr_1fr_1fr_auto] items-center gap-3 border-b px-4 py-3 last:border-b-0"
          key={schedule.id}
        >
          <span className="font-medium">{schedule.name}</span>
          <Link
            className="truncate text-muted-foreground text-sm hover:text-foreground"
            params={{ templateId: schedule.templateId }}
            to="/templates/$templateId"
          >
            {schedule.templateName}
          </Link>
          <Badge variant="secondary">{schedule.kindLabel}</Badge>
          <span className="text-muted-foreground text-sm">
            {formatTemplateScheduleOccurrence(schedule.nextOccurrence)}
          </span>
          <span className="text-muted-foreground text-sm">{schedule.recentUsage}</span>
          <Button aria-label={`Actions for ${schedule.name}`} size="icon" variant="ghost">
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function TemplateLibraryPanel({
  loading,
  templates,
}: {
  readonly loading: boolean;
  readonly templates: readonly TemplateCollectionItem[];
}) {
  if (loading) return <TemplateListSkeleton />;
  if (templates.length === 0) {
    return (
      <Empty className="min-h-64 rounded-xl border bg-card">
        <EmptyHeader>
          <EmptyTitle>No Templates yet</EmptyTitle>
          <EmptyDescription>
            Saved Templates, including unscheduled ones, will appear here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {templates.map((template) => (
        <Link
          className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40"
          key={template.id}
          params={{ templateId: template.id }}
          to="/templates/$templateId"
        >
          <div className="flex items-start gap-3">
            <LibraryBig className="mt-0.5 size-4 text-muted-foreground" />
            <div className="min-w-0">
              <h2 className="truncate font-medium">{template.name}</h2>
              <p className="text-muted-foreground text-sm">
                {template.scheduleCount === 0
                  ? "Unscheduled"
                  : `${template.scheduleCount} schedule${template.scheduleCount === 1 ? "" : "s"}`}{" "}
                · {template.taskCount} task{template.taskCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
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
        <Link className="text-muted-foreground text-sm hover:text-foreground" to="/templates">
          ← Templates
        </Link>
        {loading ? (
          <TemplateListSkeleton />
        ) : !template ? (
          <Empty className="min-h-64 rounded-xl border bg-card">
            <EmptyHeader>
              <EmptyTitle>Template not found</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <div>
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
                      className="flex items-center justify-between rounded-lg border px-3 py-2"
                      key={schedule.id}
                    >
                      <span className="font-medium text-sm">{schedule.name}</span>
                      <span className="text-muted-foreground text-sm">
                        {schedule.kindLabel} ·{" "}
                        {formatTemplateScheduleOccurrence(schedule.nextOccurrence)}
                      </span>
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
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((item) => (
        <Skeleton className="h-16 rounded-xl" key={item} />
      ))}
    </div>
  );
}

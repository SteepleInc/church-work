import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { MainContainer, PageContainer, PageWrapper } from "@/components/pageComponents";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { useLabelsCollection } from "@/data/labels/labelsData.app";
import { useTeamsCollection } from "@/data/teams/teamsData.app";
import { useChurchUsersCollection } from "@/data/users/usersData.app";
import { useCreateWeeklyServiceTemplate } from "@/data/templates/templatesData.app";

export const Route = createFileRoute("/_org/templates")({ component: TemplatesRoute });

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const mondayFirstWeekdays = [1, 2, 3, 4, 5, 6, 0] as const;

type DraftTask = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly teamId: string;
  readonly assigneeId: string;
  readonly labelId: string;
  readonly estimate: string;
  readonly placementCycleOffset: number;
  readonly placementWeekday: number;
};

function TemplatesRoute() {
  const { currentOrgOpt } = useCurrentOrgOpt();
  const churchId = currentOrgOpt?.id ?? null;
  const teams = useTeamsCollection({ churchId });
  const users = useChurchUsersCollection({ churchId });
  const labels = useLabelsCollection({ churchId });
  const createTemplate = useCreateWeeklyServiceTemplate();
  const [name, setName] = useState("Weekly Service");
  const [serviceWeekday, setServiceWeekday] = useState(0);
  const [schedule, setSchedule] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tasks, setTasks] = useState<readonly DraftTask[]>([
    {
      assigneeId: "",
      description: "",
      estimate: "",
      id: crypto.randomUUID(),
      labelId: "",
      placementCycleOffset: 0,
      placementWeekday: 0,
      teamId: teams.teamsCollection[0]?.id ?? "",
      title: "",
    },
  ]);
  const nextOccurrence = useMemo(() => nextWeekdayDate(serviceWeekday), [serviceWeekday]);

  const updateTask = (id: string, patch: Partial<DraftTask>) => {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...patch } : task)));
  };

  const addTask = (placementWeekday: number) => {
    setTasks((current) => [
      ...current,
      {
        assigneeId: "",
        description: "",
        estimate: "",
        id: crypto.randomUUID(),
        labelId: "",
        placementCycleOffset: 0,
        placementWeekday,
        teamId: teams.teamsCollection[0]?.id ?? "",
        title: "",
      },
    ]);
  };

  const save = async () => {
    if (!churchId) return;
    const validTasks = tasks.filter((task) => task.title.trim() && task.teamId);
    if (validTasks.length === 0) {
      setMessage("Add at least one Template Task with a title and Team.");
      return;
    }
    setSaving(true);
    const templateTeams = Array.from(new Set(validTasks.map((task) => task.teamId))).flatMap(
      (teamId) => {
        const team = teams.teamsCollection.find((candidate) => candidate.id === teamId);
        return team ? [{ key: team.identifier, mapped_team_id: team.id, name: team.name }] : [];
      },
    );
    const result = await createTemplate({
      churchId,
      key: slugify(name),
      name,
      schedule,
      serviceWeekday,
      startDate: nextOccurrence,
      tasks: validTasks.map((task, index) => {
        const team = teams.teamsCollection.find((candidate) => candidate.id === task.teamId);
        return {
          assignedUserId: task.assigneeId || null,
          description: task.description || null,
          estimate: task.estimate || null,
          key: `task-${index + 1}-${slugify(task.title)}`,
          labelIds: task.labelId ? [task.labelId] : [],
          placementCycleOffset: task.placementCycleOffset,
          placementWeekday: task.placementWeekday,
          templateTeamKey: team?.identifier ?? templateTeams[0]?.key ?? "team",
          title: task.title,
        };
      }),
      templateTeams,
    });
    setSaving(false);
    setMessage(result.ok ? "Template saved." : result.error.message);
  };

  return (
    <PageWrapper>
      <PageContainer>
        <MainContainer className="gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Create Template</h1>
            <p className="text-muted-foreground text-sm">
              Weekly service authoring tracer bullet: choose shape, schedule day, place tasks, and
              save or schedule.
            </p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>1. Shape</CardTitle>
              <CardDescription>
                Weekly service is the first supported Template shape.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border p-3">
                <div className="font-medium">Weekly service</div>
                <div className="text-muted-foreground text-sm">Monday–Sunday Cycle calendar</div>
              </div>
              <div className="space-y-2">
                <Label>Template name</Label>
                <Input value={name} onChange={(event) => setName(event.target.value)} />
                <Label>Service weekday</Label>
                <select
                  className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                  value={serviceWeekday}
                  onChange={(event) => setServiceWeekday(Number(event.target.value))}
                >
                  {weekdays.map((day, index) => (
                    <option key={day} value={index}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>2. Cycle calendar</CardTitle>
              <CardDescription>
                Place Template Tasks on due-date days. Status and state are intentionally absent.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-7 gap-2">
                {mondayFirstWeekdays.map((weekday) => (
                  <div key={weekday} className="bg-muted/30 min-h-28 rounded-lg border p-2">
                    <div className="mb-2 flex items-center justify-between text-xs font-medium">
                      <span>{weekdays[weekday]}</span>
                      <button
                        className="text-primary"
                        type="button"
                        onClick={() => addTask(weekday)}
                      >
                        + Task
                      </button>
                    </div>
                    {tasks
                      .filter((task) => task.placementWeekday === weekday)
                      .map((task) => (
                        <div
                          key={task.id}
                          className="bg-background mb-2 rounded border p-2 shadow-sm"
                        >
                          <Input
                            placeholder="Task title"
                            value={task.title}
                            onChange={(event) => updateTask(task.id, { title: event.target.value })}
                          />
                          <Textarea
                            className="mt-2"
                            placeholder="Description"
                            value={task.description}
                            onChange={(event) =>
                              updateTask(task.id, { description: event.target.value })
                            }
                          />
                          <div className="mt-2 grid gap-2">
                            <select
                              value={task.teamId}
                              onChange={(event) =>
                                updateTask(task.id, { teamId: event.target.value })
                              }
                            >
                              <option value="">Pick Team</option>
                              {teams.teamsCollection.map((team) => (
                                <option key={team.id} value={team.id}>
                                  {team.name}
                                </option>
                              ))}
                            </select>
                            <select
                              value={task.assigneeId}
                              onChange={(event) =>
                                updateTask(task.id, { assigneeId: event.target.value })
                              }
                            >
                              <option value="">Unassigned</option>
                              {users.usersCollection.map((user) => (
                                <option key={user.id} value={user.id}>
                                  {user.name ?? user.email ?? user.id}
                                </option>
                              ))}
                            </select>
                            <select
                              value={task.labelId}
                              onChange={(event) =>
                                updateTask(task.id, { labelId: event.target.value })
                              }
                            >
                              <option value="">No label</option>
                              {labels.labelsCollection.map((label) => (
                                <option key={label.id} value={label.id}>
                                  {label.name}
                                </option>
                              ))}
                            </select>
                            <Input
                              placeholder="Estimate"
                              value={task.estimate}
                              onChange={(event) =>
                                updateTask(task.id, { estimate: event.target.value })
                              }
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>3. Preview and save</CardTitle>
              <CardDescription>
                Preview defaults to the next {weekdays[serviceWeekday]} occurrence: {nextOccurrence}
                .
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={schedule}
                  type="checkbox"
                  onChange={(event) => setSchedule(event.target.checked)}
                />{" "}
                Create repeating weekly Template Schedule
              </label>
              <Button disabled={saving || !churchId} onClick={save}>
                {schedule ? "Save and schedule" : "Save unscheduled"}
              </Button>
              {message ? <span className="text-sm">{message}</span> : null}
            </CardContent>
          </Card>
        </MainContainer>
      </PageContainer>
    </PageWrapper>
  );
}

function nextWeekdayDate(weekday: number) {
  const date = new Date();
  const diff = (weekday - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "template"
  );
}

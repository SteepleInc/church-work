# Weekly Load

Church Task should keep planning simple while still helping teams avoid overloaded weeks.

This note captures a small Pivotal Tracker-inspired idea that fits our scheduling and template model: use recent completion history to show whether a week looks light, normal, or heavy.

## Motivation

Church work is often recurring. Templates generate the same set of tasks every scheduled week, but a week can quietly become unrealistic as more templates, key dates, and one-off tasks pile up.

The useful idea from Pivotal Tracker is not the exact language of stories, points, velocity, or iceboxes. The useful idea is:

> Look at what a team actually completed recently, then use that as a simple guide for what probably fits in an upcoming week.

For Church Task, this should be a quiet helper rather than a full planning system.

## User-facing concept

Call the concept **Weekly Load**.

Avoid agile terms like velocity, sprint, iteration, story points, or icebox in the product UI. Prefer church-native and plain-language terms:

- **Week**, not sprint or iteration
- **Task**, not story or issue
- **Unscheduled**, **Later**, or **Someday**, not icebox
- **Typical week**, not velocity
- **Light / Normal / Heavy**, not capacity warnings

Example copy:

```text
Worship
This week: 24 tasks
Typical week: 18 tasks
Looks heavy
```

## Minimal product shape

For each team and week, show:

- **This week**: count of scheduled tasks
- **Typical week**: recent average completed tasks for that team
- **Load state**: light, normal, or heavy

Initial implementation can use task count only. Do not require estimates or points.

Suggested states:

- **Light**: clearly below the team's typical completed amount
- **Normal**: close to typical
- **Heavy**: clearly above typical

The thresholds can be intentionally simple and adjusted later.

## Where it should appear

Start with the smallest useful surfaces:

1. **Team week page** — help a team see whether the week looks realistic.
2. **Template schedule preview** — show how many tasks a template adds to a team/week.
3. **Our Work** — optionally summarize teams with heavy upcoming weeks.

Template preview example:

```text
This template adds 6 tasks to Worship each scheduled week.
Worship usually completes about 18 tasks/week.
This would make that week heavier than usual.
```

## What not to import from Pivotal Tracker

Do not copy Pivotal Tracker wholesale.

Avoid adding:

- mandatory story points
- sprint terminology
- agile ceremony
- complex forecasting
- a first-class Icebox concept
- detailed predictive planning as a central workflow

If unscheduled work needs a home, use a plain term like **Unscheduled**, **Later**, or **Someday**.

## Product principle

Templates generate work. Weekly Load tells teams when the generated work is becoming unrealistic.

Keep it simple: one small signal that helps churches plan weeks without turning Church Task into a project-management methodology.

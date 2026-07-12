import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  formatCreatedAt,
  formatDisplayUrl,
  formatLocation,
  orgsColumnsDef,
} from "@/data/orgs/orgsCollectionDef";
import type { OrgCollectionItem } from "@/data/orgs/orgsData.app";

const representativeOrg = {
  id: "org_123",
  name: "Grace Church",
  slug: "grace",
  completedOnboarding: true,
  churchTimeZone: "America/New_York",
  createdAt: Date.UTC(2026, 0, 2),
  city: "Atlanta",
  state: "Georgia",
  countryCode: "US",
  logo: null,
  membersCount: 12,
  teamsCount: 3,
  size: "250-500",
  url: "https://grace.example.com/",
} satisfies OrgCollectionItem;

function renderCell(columnId: string, org: OrgCollectionItem = representativeOrg) {
  const column = orgsColumnsDef.find((candidate) => candidate.id === columnId);

  if (!column || typeof column.cell !== "function") {
    throw new Error(`Missing cell renderer for ${columnId}`);
  }

  return renderToStaticMarkup(column.cell({ row: { original: org } } as never));
}

describe("orgs collection columns", () => {
  test("defines the full admin org column set in order", () => {
    expect(orgsColumnsDef.map((column) => column.id)).toEqual([
      "name",
      "plan",
      "subscriptionStatus",
      "slug",
      "churchTimeZone",
      "completedOnboarding",
      "membersCount",
      "teamsCount",
      "location",
      "size",
      "website",
      "createdAt",
    ]);
  });

  test("renders read-only billing plan and subscription lifecycle cells", () => {
    expect(renderCell("plan")).toContain("Free");
    expect(renderCell("subscriptionStatus")).toContain("No subscription");

    const paidOrg: OrgCollectionItem = {
      ...representativeOrg,
      billing: {
        plan: "Paid",
        status: "active",
        periodEnd: Date.UTC(2026, 6, 20),
        cancelAtPeriodEnd: false,
        cancelAt: null,
        canceledAt: null,
        endedAt: null,
        graceEndsAt: null,
      },
    };
    expect(renderCell("plan", paidOrg)).toContain("Paid");
    expect(renderCell("subscriptionStatus", paidOrg)).toContain("Active");

    const pastDueOrg: OrgCollectionItem = {
      ...paidOrg,
      billing: { ...paidOrg.billing!, status: "past_due" },
    };
    expect(renderCell("subscriptionStatus", pastDueOrg)).toContain("Past due");

    const cancelScheduledOrg: OrgCollectionItem = {
      ...paidOrg,
      billing: { ...paidOrg.billing!, cancelAtPeriodEnd: true },
    };
    expect(renderCell("subscriptionStatus", cancelScheduledOrg)).toContain("Cancels at period end");
  });

  test("renders representative onboarding, location, count, website, and created cells", () => {
    expect(renderCell("completedOnboarding")).toContain("Complete");
    expect(renderCell("location")).toContain("Atlanta, Georgia, US");
    expect(renderCell("membersCount")).toContain("12");
    expect(renderCell("teamsCount")).toContain("3");
    expect(renderCell("website")).toContain("grace.example.com");
    expect(renderCell("createdAt")).toContain("Jan 2, 2026");
  });

  test("formats empty optional cells as dashes", () => {
    expect(formatLocation({ city: null, state: null, countryCode: null })).toBe("-");
    expect(formatCreatedAt(undefined)).toBe("-");
    expect(formatDisplayUrl("https://example.com/")).toBe("example.com");
  });
});

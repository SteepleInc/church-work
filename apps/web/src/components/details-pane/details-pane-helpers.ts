import { useNavigate, useSearch } from "@tanstack/react-router";
import { Array, Boolean, Match, Option, Schema, pipe } from "effect";
import type { MouseEvent } from "react";
import { useCallback, useMemo } from "react";

import {
  type DetailsPaneOrg,
  type DetailsPaneParams,
  DetailsPaneParams as DetailsPaneParamsSchema,
  type DetailsPaneTask,
  type DetailsPaneTeam,
  type DetailsPaneUnion,
  type DetailsPaneUser,
} from "@/components/details-pane/details-pane-types";

export function parseDetailsPaneState(search: { readonly "details-pane"?: unknown }) {
  return pipe(
    search["details-pane"],
    Option.fromNullable,
    Option.flatMap(Schema.decodeUnknownOption(DetailsPaneParamsSchema)),
    Option.getOrElse((): DetailsPaneParams => []),
  );
}

export function getDetailsPaneSearch(
  previousSearch: Record<string, unknown>,
  detailsPaneState: DetailsPaneParams,
): Record<string, unknown> {
  return {
    ...previousSearch,
    "details-pane": detailsPaneState.length > 0 ? detailsPaneState : undefined,
  };
}

export function getChangedDetailsPaneId(
  detailsPaneState: DetailsPaneParams,
  id: string,
): DetailsPaneParams {
  const lastEntry = detailsPaneState.at(-1);

  if (!lastEntry) {
    return detailsPaneState;
  }

  return pipe(
    detailsPaneState,
    Array.modify(detailsPaneState.length - 1, () => ({ ...lastEntry, id }) as DetailsPaneUnion),
  ) as DetailsPaneParams;
}

export function useDetailsPaneState() {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();

  const detailsPaneState = useMemo(
    () => parseDetailsPaneState(search as { readonly "details-pane"?: unknown }),
    [search],
  );

  const setDetailsPaneState = useCallback(
    (newState: DetailsPaneParams) => {
      void (navigate as (options: unknown) => Promise<unknown>)({
        replace: true,
        search: (previousSearch: Record<string, unknown>) =>
          getDetailsPaneSearch(previousSearch, newState),
      });
    },
    [navigate],
  );

  return [detailsPaneState, setDetailsPaneState] as const;
}

export function useChangeDetailsPaneId() {
  const [detailsPaneState, setDetailsPaneState] = useDetailsPaneState();

  return useCallback(
    (id: string) =>
      pipe(
        detailsPaneState,
        Array.last,
        Option.map((entry) =>
          pipe(
            Match.type<DetailsPaneUnion>(),
            Match.tag("org", (org) => ({ ...org, id })),
            Match.tag("task", (task) => ({ ...task, id })),
            Match.tag("team", (team) => ({ ...team, id })),
            Match.tag("user", (user) => ({ ...user, id })),
            Match.exhaustive,
          )(entry),
        ),
        Option.match({
          onNone: () => ({
            forceNav: () => undefined,
            onClick: () => undefined,
            search: (previousSearch: Record<string, unknown>) => previousSearch,
            to: ".",
          }),
          onSome: (updatedEntry) => {
            const updatedState = pipe(
              detailsPaneState,
              Array.modify(detailsPaneState.length - 1, () => updatedEntry),
            ) as DetailsPaneParams;

            return {
              forceNav: () => setDetailsPaneState(updatedState),
              onClick: (event: MouseEvent<HTMLAnchorElement>) => {
                pipe(
                  event.nativeEvent.ctrlKey || event.nativeEvent.metaKey,
                  Boolean.match({
                    onFalse: () => {
                      event.preventDefault();
                      setDetailsPaneState(updatedState);
                    },
                    onTrue: () => undefined,
                  }),
                );
              },
              search: (previousSearch: Record<string, unknown>) =>
                getDetailsPaneSearch(previousSearch, updatedState),
              to: ".",
            };
          },
        }),
      ),
    [detailsPaneState, setDetailsPaneState],
  );
}

export function useOpenDetailsPaneUrl(options: { readonly replace?: boolean } = {}) {
  const { replace = true } = options;
  const [detailsPaneState] = useDetailsPaneState();

  return useCallback(
    (detailsPaneParams: DetailsPaneParams) => {
      const params = replace ? detailsPaneParams : [...detailsPaneState, ...detailsPaneParams];

      return {
        search: (previousSearch: Record<string, unknown>) =>
          getDetailsPaneSearch(previousSearch, params),
        to: ".",
      };
    },
    [detailsPaneState, replace],
  );
}

export function useOpenEntityDetailsPaneUrl<T extends DetailsPaneUnion>(options: {
  readonly replace?: boolean;
  readonly defaultParams: Omit<T, "id">;
}) {
  const { replace = true, defaultParams } = options;
  const openDetailsPaneUrl = useOpenDetailsPaneUrl({ replace });

  return useCallback(
    (params: Omit<T, "_tag" | "tab"> & { readonly tab?: T["tab"] }) =>
      openDetailsPaneUrl([{ ...defaultParams, ...params } as T]),
    [defaultParams, openDetailsPaneUrl],
  );
}

export function useCloseDetailsPane() {
  const [, setDetailsPaneState] = useDetailsPaneState();

  return useCallback(() => setDetailsPaneState([]), [setDetailsPaneState]);
}

export function useIsDetailsPaneOpen() {
  const [detailsPaneState] = useDetailsPaneState();

  return detailsPaneState.length > 0;
}

export function useOpenTaskDetailsPaneUrl(options: { readonly replace?: boolean } = {}) {
  return useOpenEntityDetailsPaneUrl<DetailsPaneTask>({
    defaultParams: { _tag: "task", tab: "details" },
    replace: options.replace,
  });
}

export function useOpenTeamDetailsPaneUrl(options: { readonly replace?: boolean } = {}) {
  return useOpenEntityDetailsPaneUrl<DetailsPaneTeam>({
    defaultParams: { _tag: "team", tab: "details" },
    replace: options.replace,
  });
}

export function useOpenOrgDetailsPaneUrl(options: { readonly replace?: boolean } = {}) {
  return useOpenEntityDetailsPaneUrl<DetailsPaneOrg>({
    defaultParams: { _tag: "org", tab: "details" },
    replace: options.replace,
  });
}

export function useOpenUserDetailsPaneUrl(options: { readonly replace?: boolean } = {}) {
  return useOpenEntityDetailsPaneUrl<DetailsPaneUser>({
    defaultParams: { _tag: "user", tab: "details" },
    replace: options.replace,
  });
}

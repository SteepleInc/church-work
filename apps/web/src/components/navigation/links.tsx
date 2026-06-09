import { Link } from "@tanstack/react-router";
import { Option, pipe } from "effect";
import type { FC, HTMLAttributes, Ref } from "react";

import {
  useOpenOrgDetailsPaneUrl,
  useOpenUserDetailsPaneUrl,
} from "@/components/details-pane/details-pane-helpers";
import { cn } from "@/lib/utils";

type EntityNameProps = {
  name?: string | null;
};

export const EntityName: FC<EntityNameProps> = (props) => {
  const { name } = props;

  return pipe(
    name,
    Option.fromNullable,
    Option.match({
      onNone: () => <span className="text-muted-foreground italic">No Name</span>,
      onSome: (y) => y,
    }),
  );
};

type OrgLinkProps = {
  org: { id: string; name: string | null };
  ref?: Ref<HTMLAnchorElement>;
} & Omit<HTMLAttributes<HTMLAnchorElement>, "children">;

export const OrgLink: FC<OrgLinkProps> = (props) => {
  const {
    org: { id, name },
    className,
    ref,
    ...rest
  } = props;

  const openOrgDetailsPaneUrl = useOpenOrgDetailsPaneUrl();

  return (
    <Link
      {...openOrgDetailsPaneUrl({ id })}
      className={cn("block min-w-0 truncate", className)}
      ref={ref}
      {...rest}
    >
      <EntityName name={name} />
    </Link>
  );
};

type UserLinkProps = {
  user: { id: string; name: string | null };
  ref?: Ref<HTMLAnchorElement>;
} & Omit<HTMLAttributes<HTMLAnchorElement>, "children">;

export const UserLink: FC<UserLinkProps> = (props) => {
  const {
    user: { id, name },
    className,
    ref,
    ...rest
  } = props;

  const openUserDetailsPaneUrl = useOpenUserDetailsPaneUrl();

  return (
    <Link
      {...openUserDetailsPaneUrl({ id })}
      className={cn("block min-w-0 truncate", className)}
      ref={ref}
      {...rest}
    >
      <EntityName name={name} />
    </Link>
  );
};

export type AgentUser = {
  readonly email: string | null;
  readonly id: string;
  readonly name: string | null;
};

export type CurrentUserResponse = {
  readonly data: { readonly user: AgentUser | null };
  readonly ok: true;
  readonly operation: "currentUser";
};

export type ActiveChurchResponse =
  | {
      readonly error: {
        readonly code: "authentication_required";
        readonly message: string;
      };
      readonly ok: false;
      readonly operation: "activeChurch";
    }
  | {
      readonly data: {
        readonly activeChurch: null;
        readonly membership: null;
        readonly status: "noActiveChurch";
      };
      readonly ok: true;
      readonly operation: "activeChurch";
    }
  | {
      readonly data: {
        readonly activeChurch: {
          readonly churchTimeZone: string | null;
          readonly id: string;
          readonly name: string;
          readonly slug: string | null;
        };
        readonly membership: { readonly role: string };
        readonly status: "activeChurchReady";
      };
      readonly ok: true;
      readonly operation: "activeChurch";
    }
  | {
      readonly error: {
        readonly code: "church_not_found";
        readonly message: string;
      };
      readonly ok: false;
      readonly operation: "activeChurch";
    }
  | {
      readonly error: {
        readonly code: "not_church_member";
        readonly message: string;
      };
      readonly ok: false;
      readonly operation: "activeChurch";
    };

export type CoreWorkBatchOperation = {
  readonly id: string;
  readonly input: unknown;
  readonly operation: string;
};

export type CoreWorkBatchReadArgs = {
  readonly operations: ReadonlyArray<CoreWorkBatchOperation>;
};

export type CoreWorkBatchWriteArgs = {
  readonly operations: ReadonlyArray<CoreWorkBatchOperation>;
};

export type CoreWorkBatchResult = {
  readonly id: string;
  readonly operation: string;
  readonly result: unknown;
};

export type CoreWorkBatchReadResponse = {
  readonly ok: true;
  readonly operation: "coreWorkBatchRead";
  readonly results: ReadonlyArray<CoreWorkBatchResult>;
};

export type CoreWorkBatchWriteResponse = {
  readonly ok: true;
  readonly operation: "coreWorkBatchWrite";
  readonly results: ReadonlyArray<CoreWorkBatchResult>;
};

export const currentUserResponse = (user: AgentUser | null): CurrentUserResponse => ({
  data: { user },
  ok: true,
  operation: "currentUser",
});

export const noActiveChurchResponse = (): ActiveChurchResponse => ({
  data: { activeChurch: null, membership: null, status: "noActiveChurch" },
  ok: true,
  operation: "activeChurch",
});

export const activeChurchAuthenticationRequiredResponse = (): ActiveChurchResponse => ({
  error: {
    code: "authentication_required",
    message: "Authentication required to resolve Active Church.",
  },
  ok: false,
  operation: "activeChurch",
});

export const activeChurchResponse = (args: {
  readonly church: {
    readonly churchTimeZone: string | null;
    readonly id: string;
    readonly name: string;
    readonly slug: string | null;
  };
  readonly membership: { readonly role: string };
}): ActiveChurchResponse => ({
  data: {
    activeChurch: args.church,
    membership: args.membership,
    status: "activeChurchReady",
  },
  ok: true,
  operation: "activeChurch",
});

export const churchNotFoundResponse = (): ActiveChurchResponse => ({
  error: {
    code: "church_not_found",
    message: "Requested Church was not found.",
  },
  ok: false,
  operation: "activeChurch",
});

export const notChurchMemberResponse = (): ActiveChurchResponse => ({
  error: {
    code: "not_church_member",
    message: "User does not have Church Membership for requested Church.",
  },
  ok: false,
  operation: "activeChurch",
});

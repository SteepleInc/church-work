import { Schema } from "effect";

export const ChurchSettingsArgs = Schema.Struct({
  churchId: Schema.String,
});

export const ChurchTimeZoneUpdateArgs = Schema.Struct({
  churchId: Schema.String,
  churchTimeZone: Schema.String,
});

const ChurchSettings = Schema.Struct({
  id: Schema.String,
  churchTimeZone: Schema.Union(Schema.String, Schema.Null),
});

export const ChurchSettingsOperationResponse = Schema.Struct({
  ok: Schema.Literal(true),
  operation: Schema.Union(
    Schema.Literal("readChurchSettings"),
    Schema.Literal("updateChurchTimeZone"),
  ),
  data: Schema.Struct({ church: ChurchSettings }),
});

export const ChurchSettingsErrorResponse = Schema.Struct({
  ok: Schema.Literal(false),
  operation: Schema.Union(
    Schema.Literal("readChurchSettings"),
    Schema.Literal("updateChurchTimeZone"),
  ),
  error: Schema.Struct({
    code: Schema.Union(
      Schema.Literal("not_authenticated"),
      Schema.Literal("not_church_member"),
      Schema.Literal("not_authorized"),
      Schema.Literal("church_not_found"),
      Schema.Literal("invalid_church_time_zone"),
    ),
    message: Schema.String,
  }),
});

export const ChurchSettingsReadResponse = Schema.Union(
  ChurchSettingsOperationResponse,
  ChurchSettingsErrorResponse,
);
export const ChurchSettingsWriteResponse = Schema.Union(
  ChurchSettingsOperationResponse,
  ChurchSettingsErrorResponse,
);

export const churchSettingsResponse = (
  operation: "readChurchSettings" | "updateChurchTimeZone",
  church: Schema.Schema.Type<typeof ChurchSettings>,
) => ({
  ok: true as const,
  operation,
  data: { church },
});

export const churchSettingsErrorResponse = (
  operation: "readChurchSettings" | "updateChurchTimeZone",
  code: Schema.Schema.Type<typeof ChurchSettingsErrorResponse>["error"]["code"],
  message: string,
) => ({
  ok: false as const,
  operation,
  error: { code, message },
});

import type { ValidationError } from "@tanstack/react-form";
import { Array, pipe, Schema } from "effect";

const ErrorMessageSchema = Schema.Union(
  Schema.transform(Schema.Struct({ message: Schema.String }), Schema.String, {
    decode: (obj) => obj.message,
    encode: (str) => ({ message: str }),
    strict: true,
  }),
  Schema.String,
);

const extractErrorMessages = (errors: Array<ValidationError>) =>
  pipe(
    errors,
    Array.map((error) => Schema.decodeUnknownOption(ErrorMessageSchema)(error)),
    Array.getSomes,
    Array.join(", "),
  );

export const getFieldErrors = (errors: Array<ValidationError>): { processedError?: string } =>
  pipe(
    errors,
    Array.match({
      onEmpty: () => ({}),
      onNonEmpty: () => ({
        processedError: extractErrorMessages(errors),
      }),
    }),
  );

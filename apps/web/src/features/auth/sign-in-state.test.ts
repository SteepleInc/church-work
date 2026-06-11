import { describe, expect, test } from "bun:test";

import { getInitialSignInState, SignInState } from "./sign-in-state";

describe("sign-in state", () => {
  test("starts from the email prompt when no email was passed", () => {
    expect(getInitialSignInState({})).toEqual(SignInState.email());
  });

  test("starts from OTP only when an email was explicitly passed", () => {
    expect(getInitialSignInState({ email: "ada@example.com" })).toEqual(
      SignInState.otp({ email: "ada@example.com" }),
    );
  });
});

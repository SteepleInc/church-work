import { atom } from "jotai";

export type SignInState =
  | { readonly _tag: "email" }
  | { readonly _tag: "otp"; readonly email: string };

export const SignInState = {
  email: (): SignInState => ({ _tag: "email" }),
  otp: (params: { readonly email: string }): SignInState => ({ _tag: "otp", email: params.email }),
};

export function getInitialSignInState(params: { readonly email?: string }) {
  return params.email ? SignInState.otp({ email: params.email }) : SignInState.email();
}

export const signInStateAtom = atom<SignInState>(SignInState.email());

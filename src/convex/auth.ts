// THIS FILE IS READ ONLY. Do not touch this file unless you are correctly adding a new auth provider in accordance to the vly auth documentation

import { convexAuth } from "@convex-dev/auth/server";
import type { ConvexCredentialsConfig } from "@convex-dev/auth/server";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { Password } from "@convex-dev/auth/providers/Password";
import { emailOtp } from "./auth/emailOtp";
import { internal } from "./_generated/api";

/**
 * Two ways into the app:
 *
 *  - `password`  — organisation logins provisioned by a super admin from
 *    Settings. The account id is the *username* (lower-cased), so people sign
 *    in with username + password instead of a one-time code.
 *  - `email-otp` — the original email one-time-code flow, kept for anyone who
 *    signs themselves up with their email address.
 */
const passwordProvider = Password({
  profile(params) {
    // Accept either key so the same provider works for `username` from our
    // own sign-in form and `email` from anything that still sends one.
    const username = String(params.username ?? params.email ?? "")
      .trim()
      .toLowerCase();
    if (username.length === 0) throw new Error("Enter your username.");
    const name =
      typeof params.name === "string" && params.name.trim().length > 0
        ? params.name.trim()
        : username;
    return { email: username, name };
  },
});

/**
 * The password provider, wrapped so that only logins an organisation's super
 * admin provisioned can sign in — and a switched-off one never can. Running
 * the check before the password is compared also makes self sign-up impossible.
 */
const gatedPasswordProvider: ConvexCredentialsConfig = {
  ...passwordProvider,
  authorize: async (params, ctx) => {
    const username = String(params.username ?? params.email ?? "")
      .trim()
      .toLowerCase();
    await ctx.runQuery(internal.accounts.assertLoginAllowed, { username });
    return passwordProvider.authorize(params, ctx);
  },
};

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [gatedPasswordProvider, emailOtp, Anonymous],
});

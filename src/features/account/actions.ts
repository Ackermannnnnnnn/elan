"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ROUTES } from "@/config/routes";
import { deleteAccount } from "@/data/account";
import type { ActionResult } from "@/lib/action-result";
import { ONBOARDED_COOKIE } from "@/lib/onboarding-cookie";
import { runAction } from "@/lib/run-action";
import { deleteAccountSchema, type DeleteAccountValues } from "./schemas";

export async function deleteAccountAction(
  input: DeleteAccountValues,
): Promise<ActionResult<string>> {
  const result = await runAction(deleteAccountSchema, input, async ({ password }) => {
    const outcome = await deleteAccount(password);
    if (outcome === "wrongPassword") {
      return { ok: false, fieldErrors: { password: "wrongPassword" } };
    }
  });
  if (!result.ok) return result;
  (await cookies()).delete(ONBOARDED_COOKIE);
  redirect(`${ROUTES.login}?deleted=1`);
}

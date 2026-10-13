"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { updateOwnProfile } from "@/data/profile";
import { fieldErrorsFromZod, type ActionResult } from "@/lib/action-result";
import { profileSchema, type ProfileValues } from "./schemas";

export async function updateProfile(
  input: ProfileValues,
): Promise<ActionResult<keyof ProfileValues>> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error) };

  try {
    // `updateOwnProfile` vérifie la session avant d'écrire.
    await updateOwnProfile(parsed.data);
  } catch (error) {
    // Les redirections Next.js (session expirée) doivent remonter telles quelles.
    unstable_rethrow(error);
    return { ok: false, formError: "profileSaveFailed" };
  }

  // Le prénom apparaît dans la navigation : on rafraîchit toute la mise en page.
  revalidatePath("/", "layout");
  return { ok: true };
}

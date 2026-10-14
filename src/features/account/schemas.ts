import { z } from "zod";

/** Mot à recopier pour confirmer la suppression du compte. */
export const DELETE_CONFIRMATION_WORD = "SUPPRIMER";

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "required").max(200),
  confirmation: z
    .string()
    .trim()
    .refine((value) => value.toUpperCase() === DELETE_CONFIRMATION_WORD, "confirmationMismatch"),
});

export type DeleteAccountValues = z.input<typeof deleteAccountSchema>;

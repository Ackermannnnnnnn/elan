import { z } from "zod";
import { displayName } from "@/features/auth/schemas";

export const profileSchema = z.object({ displayName });

export type ProfileValues = z.infer<typeof profileSchema>;

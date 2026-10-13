import { z } from "zod";
import { optionalNumber } from "@/lib/form-fields";

export const priceSchema = z.object({ price: optionalNumber({ min: 0, max: 500 }) });
export type PriceFormValues = z.input<typeof priceSchema>;

export const manualItemSchema = z.object({
  name: z.string().trim().min(1, "required").max(200, "textTooLong"),
  quantityG: optionalNumber({ min: 1, max: 100000 }),
});
export type ManualItemFormValues = z.input<typeof manualItemSchema>;

import { z } from "zod";
import { normalizeBarcode } from "@/lib/open-food-facts/map";

export const barcodeSchema = z.object({
  barcode: z
    .string()
    .trim()
    .min(1, "required")
    .transform((value, context) => {
      const normalized = normalizeBarcode(value);
      if (!normalized) {
        context.addIssue({ code: "custom", message: "barcodeInvalid" });
        return z.NEVER;
      }
      return normalized;
    }),
});
export type BarcodeFormValues = z.input<typeof barcodeSchema>;

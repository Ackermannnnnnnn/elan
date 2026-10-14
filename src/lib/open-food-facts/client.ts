import "server-only";
import { type MapResult, mapOpenFoodFactsProduct } from "./map";

/**
 * Consultation d'un produit par code-barres sur Open Food Facts (gratuit, sans
 * clé). Appel fait par le SERVEUR uniquement, avec un User-Agent identifiable
 * comme le demande Open Food Facts. Limite publique : 15 consultations de
 * produit par minute et par adresse IP ; un produit déjà scanné est relu en
 * base, sans nouvel appel.
 */
const DEFAULT_BASE_URL = "https://world.openfoodfacts.org";
const FIELDS = [
  "code",
  "product_name",
  "product_name_fr",
  "generic_name_fr",
  "brands",
  "nutriments",
  "allergens_tags",
  "traces_tags",
  "ingredients_analysis_tags",
  "categories_tags",
  "serving_quantity",
  "serving_size",
  "product_quantity",
  "product_quantity_unit",
  "quantity",
].join(",");

export type LookupResult = MapResult | { ok: false; reason: "unavailable" };

export async function lookupOpenFoodFacts(barcode: string): Promise<LookupResult> {
  const base = (process.env.OPEN_FOOD_FACTS_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const userAgent =
    process.env.OPEN_FOOD_FACTS_USER_AGENT ||
    "Elan/0.4 (application personnelle de suivi nutritionnel)";

  let response: Response;
  try {
    response = await fetch(`${base}/api/v2/product/${barcode}?fields=${FIELDS}`, {
      headers: { "User-Agent": userAgent, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
  } catch (error) {
    console.error("[open-food-facts] réseau", (error as Error).message);
    return { ok: false, reason: "unavailable" };
  }

  // Produit inconnu : l'API répond 404 avec { status: 0 }.
  if (response.status === 404) return { ok: false, reason: "notFound" };
  if (!response.ok) {
    console.error("[open-food-facts] HTTP", response.status);
    return { ok: false, reason: "unavailable" };
  }
  try {
    return mapOpenFoodFactsProduct(barcode, await response.json());
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

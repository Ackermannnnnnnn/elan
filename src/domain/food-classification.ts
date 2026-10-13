/**
 * Classification d'un aliment à partir de son nom (et, pour CIQUAL, de son
 * groupe) : allergènes probables, classe de régime et rayon de magasin.
 *
 * CIQUAL ne fournit ni allergènes ni régime. Les règles ci-dessous sont
 * VOLONTAIREMENT PRUDENTES : en cas de doute, un allergène est signalé (un faux
 * positif écarte un aliment, un faux négatif mettrait quelqu'un en danger).
 * Ce module ne dépend de rien : il est aussi utilisé par le script d'import.
 */

export const ALLERGEN_CODES = [
  "gluten",
  "crustaceans",
  "eggs",
  "fish",
  "peanuts",
  "soy",
  "milk",
  "nuts",
  "celery",
  "mustard",
  "sesame",
  "sulphites",
  "lupin",
  "molluscs",
] as const;
export type AllergenCode = (typeof ALLERGEN_CODES)[number];

export const DIET_CLASSES = ["plant", "vegetarian", "fish", "meat", "unknown"] as const;
export type DietClass = (typeof DIET_CLASSES)[number];

export const AISLES = [
  "produce",
  "meat_fish",
  "dairy_eggs",
  "bakery",
  "grocery",
  "frozen",
  "drinks",
  "other",
] as const;
export type Aisle = (typeof AISLES)[number];

/** Minuscules, sans accents ni ligatures, ponctuation remplacée par des espaces. */
export function normalizeFoodName(name: string): string {
  return name
    .replace(/[œŒ]/g, "oe")
    .replace(/[æÆ]/g, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Mots-clés reconnus en début de mot : « oeuf » trouve « oeufs », pas « boeuf ». */
function matcher(words: readonly string[]): RegExp {
  return new RegExp(`(?:^| )(?:${words.join("|")})`);
}

// Expressions réécrites avant la recherche d'allergènes ou de produits animaux,
// parce qu'elles contiennent un mot-clé trompeur : « lait de coco » n'est pas du
// lait, mais « beurre de cacahuète » reste de l'arachide (seul « beurre » tombe).
const NEUTRAL_REWRITES: ReadonlyArray<readonly [RegExp, string]> = [
  [/(?:^| )(?:lait|creme|noix) de coco/g, " coco"],
  [/(?:^| )noix de muscade/g, " muscade"],
  [/(?:^| )beurre (?:de |d )(?=cacao|karite|cacahuete|arachide|amande|noisette|cajou)/g, " "],
  [/(?:^| )creme de marrons?/g, " marrons"],
  [/(?:^| )a la coque/g, " "],
  [/(?:^| )oeufs? (?:de |d )(?:oie|cane|caille|autruche|poule|dinde)/g, " oeuf"],
  [
    /(?:^| )pains? (?:pour |a )(?:burger|hamburger|hot dog)s?(?: ou (?:burger|hamburger|hot dog))?/g,
    " pain",
  ],
  [/(?:^| )fruits? a coque/g, " noix"],
  [/(?:^| )melon miel/g, " melon"],
  [/(?:^| )(?:vermicelles?|nouilles?) de riz/g, " riz"],
  [/(?:^| )haricots? beurre/g, " haricot"],
  [/(?:^| )courges? spaghetti/g, " courge"],
  [/(?:^| )groseilles? a maquereau/g, " groseille"],
  [/(?:^| )pommes? de terre noisettes?/g, " pomme de terre"],
  [/(?:^| )semoule de (?:manioc|mais|riz)/g, " "],
  [/(?:^| )noix (?:et corail|de saint jacques|de veau|de joue|de coquilles? saint jacques)/g, " "],
  [/(?:^| )(?:pour|a) pizzas?/g, " "],
  [/(?:^| )farine (?:de |d )(?=riz|mais|sarrasin|pois chiche|chataigne|coco|soja|lentille)/g, " "],
];

function neutralize(normalized: string): string {
  let text = ` ${normalized}`;
  for (const [pattern, replacement] of NEUTRAL_REWRITES) text = text.replace(pattern, replacement);
  return text.replace(/\s+/g, " ").trim();
}

// Produits végétaux qui imitent un produit animal (« boisson au soja »,
// « saucisse végétale ») : le mot imité ne doit pas les requalifier.
const PLANT_ALTERNATIVE_WORDS = [
  "boissons? (?:au |a la |a l |aux |de |d )?(?:soja|amande|avoine|riz|coco|noisette|epeautre|vegetale)",
  "lait (?:de |d )(?:soja|amande|avoine|riz|noisette)",
  "(?:lait|creme) de coco",
  "(?:dessert|specialite|yaourt|fromage|creme|saucisse|steak|burger|hache|galette|nugget|pate|emince|boulette|escalope|aiguillette|lardon|jambon|chair|tranche)s? (?:vegetale?s?|au soja|de soja|soja)\\b",
  "(?:a base|alternative)s? vegetales?",
  "sauce vegetale type bolognaise",
  "(?:nuggets?|croquettes?)(?: ou (?:nuggets?|croquettes?))? panees? de soja",
  "vegetarien",
  "vegan",
];
const PLANT_ALTERNATIVE = matcher(PLANT_ALTERNATIVE_WORDS);
const PLANT_ALTERNATIVE_ALL = new RegExp(`(?:^| )(?:${PLANT_ALTERNATIVE_WORDS.join("|")})`, "g");

const ALLERGEN_WORDS: Record<AllergenCode, readonly string[]> = {
  gluten: [
    "ble\\b",
    "froment",
    "farine",
    "pain",
    "pates? (?:a (?:tarte|pizza|crepes?|gateau|choux|pain|biscuit|beignet)|brisee|feuillet|sablee|pizza)",
    "pates\\b",
    "semoule",
    "couscous",
    "boulgour",
    "epeautre",
    "seigle",
    "orge",
    "avoine",
    "biscuit",
    "biscotte",
    "gateau",
    "cake",
    "brioche",
    "croissant",
    "viennoiserie",
    "crepe",
    "gaufre",
    "pizza",
    "quiche",
    "tarte",
    "tourte",
    "lasagne",
    "ravioli",
    "tortellini",
    "gnocchi",
    "spaghetti",
    "macaroni",
    "nouille",
    "vermicelle",
    "cannelloni",
    "chapelure",
    "pane\\b",
    "panee?s?\\b",
    "cordon bleu",
    "nugget",
    "beignet",
    "croque",
    "sandwich",
    "burger",
    "hamburger",
    "wrap",
    "tortilla de ble",
    "pita",
    "bagel",
    "muffin",
    "madeleine",
    "financier",
    "cookie",
    "muesli",
    "cereal",
    "seitan",
    "malt",
    "biere",
    "chapati",
    "naan",
    "blini",
    "crouton",
    "feuillete",
    "friand",
    "chausson",
    "eclair",
    "profiterole",
    "chou a la creme",
    "speculoos",
    "gaufrette",
    "quenelle",
    "taboule",
    "fajita",
    "panure",
    "boulette",
    "gratin",
    "bechamel",
    "tagliatelle",
    "penne",
    "fusilli",
    "coquillette",
    "torti\\b",
    "galette des rois",
    "pain d epices",
  ],
  milk: [
    "lait(?:s|ier|iers|iere|ieres|age)?\\b",
    "fromage",
    "yaourt",
    "yogourt",
    "creme",
    "beurre",
    "bechamel",
    "gratin",
    "quiche",
    "glace",
    "chocolat au lait",
    "chocolat blanc",
    "brioche",
    "croissant",
    "viennoiserie",
    "lactose",
    "babeurre",
    "petit suisse",
    "skyr",
    "kefir",
    "ghee",
    "flan",
    "entremets",
    "mousse au chocolat",
    "milk",
    "cappuccino",
    "latte",
    "chantilly",
    "tiramisu",
    "cheesecake",
    "fondue",
    "raclette",
    "tartiflette",
    "croque",
    "pizza",
    "lasagne",
    "cordon bleu",
    "emmental",
    "comte",
    "gruyere",
    "mozzarella",
    "parmesan",
    "camembert",
    "brie",
    "chevre",
    "feta",
    "ricotta",
    "mascarpone",
    "reblochon",
    "roquefort",
    "cheddar",
    "gouda",
    "edam\\b",
    "beaufort",
    "cantal\\b",
    "munster",
    "mimolette",
    "coulommiers",
    "tomme",
    "saint nectaire",
    "fourme",
    "bleu d",
    "maroilles",
    "boursin",
    "carre frais",
    "cake",
    "gateau",
    "madeleine",
    "financier",
    "creme brulee",
    "panna cotta",
    "caseine",
    "lactoserum",
    "whey",
    "custard",
    "dessert lacte",
    "riz au lait",
    "pain au lait",
    "galette des rois",
  ],
  eggs: [
    "oeuf",
    "omelette",
    "mayonnaise",
    "quiche",
    "crepe",
    "gaufre",
    "brioche",
    "gateau",
    "cake",
    "madeleine",
    "financier",
    "meringue",
    "flan",
    "clafoutis",
    "tiramisu",
    "mousse au chocolat",
    "creme brulee",
    "creme anglaise",
    "ile flottante",
    "aux oeufs",
    "aioli",
    "quenelle",
    "macaron",
    "eclair",
    "chou a la creme",
    "beignet",
    "blini",
    "pain perdu",
    "carbonara",
    "tortilla espagnole",
    "nouille",
    "pates fraiches",
    "biscuit",
    "cookie",
    "muffin",
    "galette des rois",
    "tagliatelle",
    "surimi",
    "remoulade",
    "tartare",
    "nugget",
    "cordon bleu",
    "pane\\b",
    "panee?s?\\b",
  ],
  fish: [
    "poisson",
    "saumon",
    "thon",
    "cabillaud",
    "colin",
    "lieu",
    "merlu",
    "sardine",
    "maquereau",
    "truite",
    "hareng",
    "anchois",
    "sole\\b",
    "bar\\b",
    "dorade",
    "daurade",
    "fletan",
    "eglefin",
    "haddock",
    "raie",
    "rouget",
    "merlan",
    "limande",
    "carrelet",
    "tilapia",
    "panga",
    "perche",
    "brochet",
    "sandre",
    "espadon",
    "surimi",
    "caviar",
    "oeufs de lump",
    "tarama",
    "bouillabaisse",
    "sushi",
    "nuoc",
    "sauce poisson",
    "brandade",
    "morue",
    "anguille",
    "lotte",
    "turbot",
    "saint pierre",
    "loup de mer",
    "mulet",
    "hoki",
    "omble",
    "esturgeon",
    "sprat",
    "pilchard",
    "rillettes de thon",
    "accras",
    "huile de foie de morue",
    "huile de poisson",
  ],
  crustaceans: [
    "crevette",
    "crabe",
    "homard",
    "langouste",
    "langoustine",
    "ecrevisse",
    "gambas",
    "surimi",
    "fruits de mer",
    "paella",
    "bouillabaisse",
    "tourteau",
    "araignee de mer",
    "bisque",
  ],
  molluscs: [
    "moule",
    "huitre",
    "calmar",
    "calamar",
    "encornet",
    "seiche",
    "poulpe",
    "saint jacques",
    "bulot",
    "palourde",
    "coque",
    "escargot",
    "bigorneau",
    "praire",
    "ormeau",
    "fruits de mer",
    "paella",
    "couteau",
    "telline",
    "clam",
  ],
  peanuts: ["arachide", "cacahuete", "satay", "peanut"],
  soy: [
    "soja",
    "tofu",
    "tempeh",
    "edamame",
    "miso",
    "tamari",
    "proteines vegetales texturees",
    "sauce soja",
    "lecithine de soja",
    "yuba",
  ],
  nuts: [
    "amande",
    "noisette",
    "noix",
    "cajou",
    "pecan",
    "pistache",
    "macadamia",
    "praline",
    "nougat",
    "frangipane",
    "gianduja",
    "pate a tartiner",
    "massepain",
    "pate d amande",
    "galette des rois",
    "financier",
    "macaron",
  ],
  celery: ["celeri"],
  mustard: ["moutarde", "vinaigrette", "remoulade", "mayonnaise", "sauce salade"],
  sesame: ["sesame", "tahin", "tahini", "houmous", "hoummos", "hummus", "halva", "gomasio"],
  sulphites: [
    "vin\\b",
    "vins\\b",
    "vinaigre",
    "vinaigrette",
    "champagne",
    "cidre",
    "porto",
    "martini",
    "abricot sec",
    "raisin sec",
    "figue sechee?",
    "fruits secs",
    "biere",
    "pineau",
    "sangria",
    "moutarde",
    "cornichon",
  ],
  lupin: ["lupin"],
};

const ALLERGEN_MATCHERS = ALLERGEN_CODES.map(
  (code) => [code, matcher(ALLERGEN_WORDS[code])] as const,
);

/**
 * Allergènes probables d'après le nom. Les alternatives végétales (« boisson
 * au soja ») ne déclenchent pas le lait, mais gardent le soja, l'amande, etc.
 */
export function detectAllergens(name: string): AllergenCode[] {
  const normalized = normalizeFoodName(name);
  const isPlantAlternative = PLANT_ALTERNATIVE.test(normalized);
  const text = neutralize(normalized);
  const found: AllergenCode[] = [];
  // « sans gluten » est une mention réglementée (moins de 20 mg/kg).
  const glutenFree = /(?:^| )sans gluten/.test(text);
  for (const [code, pattern] of ALLERGEN_MATCHERS) {
    if (code === "milk" && isPlantAlternative) continue;
    if (code === "gluten" && glutenFree) continue;
    if (pattern.test(text)) found.push(code);
  }
  return found;
}

// --- Régime ------------------------------------------------------------------------

const MEAT = matcher([
  "boeuf",
  "veau",
  "porc",
  "poulet",
  "dinde",
  "agneau",
  "mouton",
  "canard",
  "lapin",
  "jambon",
  "lardon",
  "bacon",
  "saucisse",
  "saucisson",
  "chorizo",
  "merguez",
  "viande",
  "steak hache",
  "bolognaise",
  "carbonara",
  "kebab",
  "hachis",
  "cassoulet",
  "choucroute garnie",
  "poule",
  "pintade",
  "caille",
  "gibier",
  "chevreuil",
  "sanglier",
  "foie",
  "rillette",
  "pate de campagne",
  "pate de foie",
  "pate en croute",
  "terrine",
  "andouill",
  "boudin",
  "cervelas",
  "salami",
  "gelatine",
  "nugget",
  "cordon bleu",
  "escalope",
  "knack",
  "hot dog",
  "roti de",
  "entrecote",
  "filet mignon",
  "magret",
  "confit de canard",
  "gesier",
  "tripe",
  "rognon",
  "langue",
  "ris de veau",
  "cheval",
  "abats",
  "coppa",
  "pancetta",
  "mortadelle",
  "rosette",
  "lard",
  "pot au feu",
  "blanquette",
  "bourguignon",
  "couscous royal",
  "tajine",
  "moussaka",
  "parmentier",
  "paupiette",
  "chipolata",
  "bouchee a la reine",
  "croque monsieur",
  "steak",
  "cote de",
  "jarret",
  "gigot",
  "poitrine",
  "travers",
  "echine",
  "faux filet",
  "bavette",
  "onglet",
  "rumsteck",
  "tournedos",
  "carpaccio",
  "chili con carne",
  "raviolis? (?:au boeuf|a la viande)",
  "cuisse",
  "aiguillette",
  "pilon",
  "aile",
  "manchon",
  "oie\\b",
  "autruche",
  "kangourou",
  "bison",
  "pigeon",
  "faisan",
  "perdrix",
]);
const VEGETARIAN_ANIMAL = matcher([
  "lait(?:s|ier|iers|iere|ieres|age)?\\b",
  "fromage",
  "yaourt",
  "yogourt",
  "creme",
  "beurre",
  "oeuf",
  "omelette",
  "mayonnaise",
  "miel",
  "bechamel",
  "gratin",
  "quiche",
  "glace",
  "brioche",
  "croissant",
  "viennoiserie",
  "gateau",
  "cake",
  "madeleine",
  "financier",
  "flan",
  "chocolat au lait",
  "chocolat blanc",
  "petit suisse",
  "skyr",
  "kefir",
  "ghee",
  "babeurre",
  "chantilly",
  "tiramisu",
  "crepe",
  "gaufre",
  "pizza",
  "fondue",
  "raclette",
  "emmental",
  "comte",
  "gruyere",
  "mozzarella",
  "parmesan",
  "camembert",
  "brie",
  "chevre",
  "feta",
  "ricotta",
  "mascarpone",
  "reblochon",
  "roquefort",
  "cheddar",
  "gouda",
  "edam\\b",
  "cantal\\b",
  "tomme",
  "meringue",
  "pain au lait",
  "pain perdu",
  "mousse au chocolat",
  "riz au lait",
  "entremets",
  "custard",
  "lactose",
  "caseine",
]);
const FISH = matcher(
  [...ALLERGEN_WORDS.fish, ...ALLERGEN_WORDS.crustaceans, ...ALLERGEN_WORDS.molluscs].filter(
    // « coque » et « couteau » sont trop ambigus hors du rayon poissonnerie.
    (word) => !["coque", "couteau", "accras"].includes(word),
  ),
);

// Groupes et sous-groupes CIQUAL (codes) dont la classe est connue d'avance.
const PLANT_GROUPS = [
  "0201",
  "0202",
  "0203",
  "0204",
  "0205",
  "0301",
  "0302",
  "0304",
  "0601",
  "0602",
  "0603",
  "0701",
  "0703",
  "0704",
  "0707",
  "0802",
  "0902",
  "1002",
  "1004",
  "1005",
  "1006",
  "1007",
  "1009",
  "1010",
];
const VEGETARIAN_GROUPS = [
  "0410",
  "0501",
  "0502",
  "0503",
  "0504",
  "0901",
  "0903",
  "0705",
  "0706",
  "0709",
  "0801",
  "0803",
  "0702",
];
const PLANT_SUBGROUPS = ["040309", "050205", "050306", "060205"];
const VEGETARIAN_SUBGROUPS = ["060204"];

// Produits végétaux usuels hors des groupes végétaux de CIQUAL (sauces, condiments…).
const PLANT_NAMES = matcher([
  "sauce soja",
  "ketchup",
  "moutarde",
  "vinaigre",
  "tofu",
  "tempeh",
  "seitan",
  "houmous",
  "hoummos",
  "falafel",
  "harissa",
  "sauce tomate (?:aux olives|aux oignons|aux champignons|aux petits legumes|nature)",
  "sauce aigre douce",
  "sauce barbecue",
  "tahin",
  "levure",
  "bouillon de legumes",
]);

const RANK: Record<DietClass, number> = { plant: 0, vegetarian: 1, fish: 2, meat: 3, unknown: -1 };

/** Classe de régime d'après le nom seul (aliments personnels, Open Food Facts). */
function dietFromName(text: string): DietClass | null {
  if (MEAT.test(text)) return "meat";
  if (FISH.test(text)) return "fish";
  if (VEGETARIAN_ANIMAL.test(text)) return "vegetarian";
  return null;
}

/**
 * Classe de régime. Avec un groupe CIQUAL, le groupe donne une base que les
 * mots-clés peuvent seulement durcir (un plat de légumes « au lard » devient
 * « viande »). Sans groupe, un nom sans mot-clé animal reste « inconnu ».
 */
export function classifyDiet(
  name: string,
  ciqual?: { subgroup: string; subsubgroup: string },
): DietClass {
  const normalized = normalizeFoodName(name);
  // Mentions explicites de CIQUAL : « (ne convient pas aux véganes ou végétaliens) ».
  const notVegan = /ne convient pas aux veganes/.test(normalized);
  const statedVegan = !notVegan && /convient aux veganes/.test(normalized);
  const cleaned = normalized.replace(
    /(?:ne )?convient (?:pas )?aux veganes(?: ou vegetaliens)?/g,
    " ",
  );
  const isPlantAlternative = PLANT_ALTERNATIVE.test(cleaned);
  const text = neutralize(cleaned);
  if (statedVegan) return "plant";

  // Un aliment qui contient probablement du lait ou des œufs n'est pas végétalien.
  const animalAllergen = detectAllergens(name).some((code) => code === "milk" || code === "eggs");
  const result = classifyDietFromText(text, isPlantAlternative, ciqual);
  if (result === "plant" && (animalAllergen || notVegan)) return "vegetarian";
  if (result === "unknown" && notVegan) return "vegetarian";
  if (result === "unknown" && !animalAllergen && PLANT_NAMES.test(text)) return "plant";
  return result;
}

function classifyDietFromText(
  text: string,
  isPlantAlternative: boolean,
  ciqual: { subgroup: string; subsubgroup: string } | undefined,
): DietClass {
  let base: DietClass = "unknown";
  if (ciqual) {
    const { subgroup, subsubgroup } = ciqual;
    if (PLANT_SUBGROUPS.includes(subsubgroup)) base = "plant";
    else if (VEGETARIAN_SUBGROUPS.includes(subsubgroup)) base = "vegetarian";
    else if (["0401", "0402", "0403", "0404"].includes(subgroup)) base = "meat";
    else if (["0405", "0406", "0407", "0408", "0409", "0904"].includes(subgroup)) base = "fish";
    else if (VEGETARIAN_GROUPS.includes(subgroup)) base = "vegetarian";
    else if (PLANT_GROUPS.includes(subgroup)) base = "plant";
  }

  // Une alternative végétale déclarée n'est jamais requalifiée par « lait » ou « fromage ».
  if (isPlantAlternative && (base === "plant" || base === "unknown")) {
    const rest = text.replace(PLANT_ALTERNATIVE_ALL, " ");
    if (MEAT.test(rest)) return "meat";
    if (FISH.test(rest)) return "fish";
    return "plant";
  }
  if (base === "meat" || base === "fish") return base;

  const fromName = dietFromName(text);
  if (!fromName) return base;
  if (base === "unknown") return fromName;
  return RANK[fromName] > RANK[base] ? fromName : base;
}

/** Un aliment de cette classe est-il compatible avec le régime ? (`unknown` : oui, à vérifier.) */
export function dietAllows(
  diet: "omnivore" | "flexitarian" | "pescatarian" | "vegetarian" | "vegan",
  foodClass: DietClass,
): boolean {
  if (foodClass === "unknown") return true;
  switch (diet) {
    case "vegan":
      return foodClass === "plant";
    case "vegetarian":
      return foodClass === "plant" || foodClass === "vegetarian";
    case "pescatarian":
      return foodClass !== "meat";
    default:
      return true;
  }
}

// --- Rayon -------------------------------------------------------------------------

/** Rayon de magasin d'un aliment CIQUAL, d'après son groupe. */
export function aisleForCiqual(ciqual: {
  group: string;
  subgroup: string;
  subsubgroup: string;
}): Aisle {
  const { group, subgroup, subsubgroup } = ciqual;
  if (["020402", "020403", "020404"].includes(subsubgroup)) return "grocery";
  if (subgroup === "0203" || subgroup === "0205") return "grocery";
  if (group === "02") return "produce";
  if (subgroup === "0302") return subsubgroup === "030202" ? "grocery" : "bakery";
  if (group === "03") return "grocery";
  if (subgroup === "0410") return "dairy_eggs";
  if (group === "04") return "meat_fish";
  if (group === "05") return "dairy_eggs";
  if (group === "06") return "drinks";
  if (subgroup === "0705") return "bakery";
  if (group === "07") return "grocery";
  if (group === "08") return "frozen";
  if (subgroup === "0901" || subgroup === "0903") return "dairy_eggs";
  if (group === "09" || group === "10") return "grocery";
  return "other";
}

/** Rayon probable d'un aliment hors CIQUAL, d'après sa classe et son nom. */
export function aisleFromName(name: string, diet: DietClass): Aisle {
  const text = normalizeFoodName(name);
  if (diet === "meat" || diet === "fish") return "meat_fish";
  if (
    matcher(["lait\\b", "laits\\b", "yaourt", "fromage", "oeuf", "beurre", "creme", "skyr"]).test(
      text,
    )
  ) {
    return "dairy_eggs";
  }
  if (matcher(["pain", "baguette", "croissant", "brioche"]).test(text)) return "bakery";
  if (matcher(["jus", "eau", "soda", "boisson", "biere", "vin\\b"]).test(text)) return "drinks";
  return "other";
}

/** État de préparation déduit du nom CIQUAL (« …, cru », « …, cuit à l'eau »). */
export function preparationFromName(name: string): "raw" | "cooked" | "as_sold" {
  const text = normalizeFoodName(name);
  if (/(?:^| )(?:crue?s?)(?: |$)/.test(text)) return "raw";
  if (
    matcher([
      "cuit",
      "bouilli",
      "grille",
      "roti",
      "poele",
      "frit",
      "braise",
      "vapeur",
      "saute",
      "a l eau",
      "au four",
      "mijote",
      "rissole",
      "poche",
      "a l etouffee",
      "au micro",
    ]).test(text)
  ) {
    return "cooked";
  }
  return "as_sold";
}

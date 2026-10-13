import { describe, expect, it } from "vitest";
import {
  aisleForCiqual,
  classifyDiet,
  detectAllergens,
  dietAllows,
  normalizeFoodName,
  preparationFromName,
} from "./food-classification";

const ciqual = (subsubgroup: string) => ({
  group: subsubgroup.slice(0, 2),
  subgroup: subsubgroup.slice(0, 4),
  subsubgroup,
});

describe("normalizeFoodName", () => {
  it("retire accents, ligatures et ponctuation", () => {
    expect(normalizeFoodName("Œuf à la coque, cuit")).toBe("oeuf a la coque cuit");
    expect(normalizeFoodName("Pâtes  sèches (blé)")).toBe("pates seches ble");
  });
});

describe("detectAllergens", () => {
  it.each([
    ["Lait demi-écrémé, UHT", ["milk"]],
    ["Laitue, crue", []],
    ["Lait de coco", []],
    ["Boisson au soja, nature", ["soy"]],
    ["Boisson à l'amande, nature", ["nuts"]],
    ["Beurre de cacahuète", ["peanuts"]],
    ["Beurre doux", ["milk"]],
    ["Noix de coco, amande, mûre", ["nuts"]],
    ["Noix de cajou, grillée", ["nuts"]],
    ["Pâtes sèches, cuites", ["gluten"]],
    ["Pâte de fruits", []],
    ["Farine de riz", []],
    ["Farine de blé tendre", ["gluten"]],
    ["Blette, crue", []],
    ["Edamame, cuit", ["soy"]],
    ["Oeuf à la coque", ["eggs"]],
    ["Crevette, cuite", ["crustaceans"]],
    ["Moule, cuite", ["molluscs"]],
    ["Saumon, cru", ["fish"]],
    ["Barre céréalière chocolatée", ["gluten"]],
    ["Houmous", ["sesame"]],
    ["Céleri-rave, cru", ["celery"]],
    ["Tomate, purée, appertisée", []],
  ])("%s → %j", (name, expected) => {
    expect(detectAllergens(name).sort()).toEqual([...expected].sort());
  });

  it("reste prudent sur un plat composé", () => {
    expect(detectAllergens("Lasagnes à la bolognaise")).toEqual(
      expect.arrayContaining(["gluten", "milk"]),
    );
    expect(detectAllergens("Quiche lorraine")).toEqual(
      expect.arrayContaining(["gluten", "milk", "eggs"]),
    );
  });
});

describe("classifyDiet", () => {
  it("part du groupe CIQUAL", () => {
    expect(classifyDiet("Poulet, filet, cru", ciqual("040203"))).toBe("meat");
    expect(classifyDiet("Cabillaud, cru", ciqual("040601"))).toBe("fish");
    expect(classifyDiet("Lentille corail, sèche", ciqual("020303"))).toBe("plant");
    expect(classifyDiet("Yaourt nature", ciqual("050201"))).toBe("vegetarian");
    expect(classifyDiet("Oeuf d'oie, cru", ciqual("041002"))).toBe("vegetarian");
  });

  it("durcit un groupe végétal d'après le nom", () => {
    expect(classifyDiet("Pain au lait", ciqual("030201"))).toBe("vegetarian");
    expect(classifyDiet("Lentilles cuisinées au lard", ciqual("020301"))).toBe("meat");
  });

  it("ne requalifie pas une alternative végétale", () => {
    expect(classifyDiet("Lait de coco")).toBe("plant");
    expect(classifyDiet("Boisson au soja, nature", ciqual("060205"))).toBe("plant");
    expect(classifyDiet("Saucisse végétale au tofu")).toBe("plant");
    expect(classifyDiet("Poulet au curry et au lait de coco")).toBe("meat");
  });

  it("suit les mentions explicites de CIQUAL", () => {
    expect(
      classifyDiet(
        "Quenelle au tofu (ne convient pas aux véganes ou végétaliens)",
        ciqual("040309"),
      ),
    ).toBe("vegetarian");
    expect(classifyDiet("Saucisse végétale (convient aux véganes ou végétaliens)")).toBe("plant");
  });

  it("laisse « inconnu » un nom sans indice", () => {
    expect(classifyDiet("Mon plat maison")).toBe("unknown");
    expect(classifyDiet("Galette maison au fromage")).toBe("vegetarian");
  });
});

describe("dietAllows", () => {
  it("applique chaque régime", () => {
    expect(dietAllows("vegan", "vegetarian")).toBe(false);
    expect(dietAllows("vegan", "plant")).toBe(true);
    expect(dietAllows("vegetarian", "fish")).toBe(false);
    expect(dietAllows("pescatarian", "fish")).toBe(true);
    expect(dietAllows("pescatarian", "meat")).toBe(false);
    expect(dietAllows("omnivore", "meat")).toBe(true);
    expect(dietAllows("vegan", "unknown")).toBe(true);
  });
});

describe("aisleForCiqual et preparationFromName", () => {
  it("range les aliments par rayon", () => {
    expect(aisleForCiqual(ciqual("020101"))).toBe("produce");
    expect(aisleForCiqual(ciqual("020303"))).toBe("grocery");
    expect(aisleForCiqual(ciqual("030201"))).toBe("bakery");
    expect(aisleForCiqual(ciqual("041002"))).toBe("dairy_eggs");
    expect(aisleForCiqual(ciqual("040203"))).toBe("meat_fish");
  });

  it("reconnaît l'état cru ou cuit", () => {
    expect(preparationFromName("Riz blanc, cru")).toBe("raw");
    expect(preparationFromName("Tomate cerise, crue")).toBe("raw");
    expect(preparationFromName("Lentille verte, bouillie/cuite à l'eau")).toBe("cooked");
    expect(preparationFromName("Pain de campagne")).toBe("as_sold");
    expect(preparationFromName("Écrevisse, crue")).toBe("raw");
  });
});

describe("cas réels de CIQUAL", () => {
  it("évite les faux amis", () => {
    expect(
      classifyDiet("Pain pour burger ou hot dog (bun) complet, préemballé", ciqual("030201")),
    ).toBe("plant");
    expect(classifyDiet("Oeuf de dinde, cru", ciqual("041002"))).toBe("vegetarian");
    expect(
      detectAllergens("Muesli floconneux aux fruits, fruits à coque et/ou graines").sort(),
    ).toEqual(["gluten", "nuts"]);
    expect(classifyDiet("Saumon farci, préemballé", ciqual("010304"))).toBe("fish");
  });
});

describe("mentions particulières", () => {
  it("respecte « sans gluten » et les noms trompeurs", () => {
    expect(detectAllergens("Pâtes sèches, sans gluten, crues")).toEqual([]);
    expect(classifyDiet("Melon miel, chair, cru", ciqual("020401"))).toBe("plant");
    expect(detectAllergens("Sauce tomate cuisinée pour pizza")).toEqual([]);
  });
});

describe("faux amis (suite)", () => {
  it("reconnaît le riz, le maïs et les condiments végétaux", () => {
    expect(detectAllergens("Vermicelles de riz sèches, crues")).toEqual([]);
    expect(detectAllergens("Tortilla souple (à garnir), à base de maïs")).toEqual([]);
    expect(detectAllergens("Gari, semoule de manioc fermentée et séchée")).toEqual([]);
    expect(detectAllergens("Coquille Saint-Jacques, noix et corail, crue")).toEqual(["molluscs"]);
    expect(classifyDiet("Sauce végétale type bolognaise, aux protéines de soja")).toBe("plant");
    expect(classifyDiet("Sauce soja, préemballée", ciqual("100101"))).toBe("plant");
    expect(classifyDiet("Ketchup, préemballé", ciqual("100101"))).toBe("plant");
  });
});

describe("faux amis (fruits et légumes)", () => {
  it.each([
    "Melon cantaloup (par ex.: Charentais), chair sans peau, sans pépins, cru",
    "Haricot beurre, cru",
    "Courge spaghetti, chair sans peau, cuite",
    "Groseille à maquereau, crue",
    "Pomme de terre noisette, surgelée, cuite",
  ])("%s n'a pas d'allergène", (name) => {
    expect(detectAllergens(name)).toEqual([]);
  });
});

describe("pâtes et pâtes à…", () => {
  it("distingue la pâte à tarte de la pâte à tartiner", () => {
    expect(detectAllergens("Pâte à tartiner aux noisettes et au cacao")).toEqual(["nuts"]);
    expect(detectAllergens("Pâte à tarte brisée, crue")).toContain("gluten");
  });
});

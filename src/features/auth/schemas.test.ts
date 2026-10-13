import { describe, expect, it } from "vitest";
import { fieldErrorsFromZod } from "@/lib/action-result";
import { forgotPasswordSchema, resetPasswordSchema, signInSchema, signUpSchema } from "./schemas";

const errorsOf = (schema: { safeParse: (v: unknown) => unknown }, value: unknown) => {
  const result = schema.safeParse(value) as ReturnType<typeof signUpSchema.safeParse>;
  return result.success ? {} : fieldErrorsFromZod(result.error);
};

describe("inscription", () => {
  const valid = {
    displayName: "Camille",
    email: "camille@example.test",
    password: "une phrase 42",
  };

  it("accepte des données valides et normalise l'e-mail et le prénom", () => {
    const parsed = signUpSchema.parse({
      displayName: "  Camille ",
      email: "  Camille@Example.TEST ",
      password: "une phrase 42",
    });
    expect(parsed).toEqual({ ...valid });
  });

  it("ne modifie jamais le mot de passe saisi", () => {
    const password = "  espaces conservés  ";
    expect(signUpSchema.parse({ ...valid, password }).password).toBe(password);
  });

  it("exige chaque champ", () => {
    expect(errorsOf(signUpSchema, { displayName: " ", email: "", password: "" })).toEqual({
      displayName: "required",
      email: "required",
      password: "passwordTooShort",
    });
  });

  it.each(["pas-un-email", "a@b", "a b@example.test", "@example.test"])(
    "refuse l'adresse %j",
    (email) => {
      expect(errorsOf(signUpSchema, { ...valid, email })).toEqual({ email: "emailInvalid" });
    },
  );

  it("borne la longueur du mot de passe (10 à 72 caractères)", () => {
    expect(errorsOf(signUpSchema, { ...valid, password: "a".repeat(9) })).toEqual({
      password: "passwordTooShort",
    });
    expect(errorsOf(signUpSchema, { ...valid, password: "a".repeat(10) })).toEqual({});
    expect(errorsOf(signUpSchema, { ...valid, password: "a".repeat(72) })).toEqual({});
    expect(errorsOf(signUpSchema, { ...valid, password: "a".repeat(73) })).toEqual({
      password: "passwordTooLong",
    });
  });

  it("borne la longueur du prénom", () => {
    expect(errorsOf(signUpSchema, { ...valid, displayName: "a".repeat(61) })).toEqual({
      displayName: "displayNameTooLong",
    });
  });
});

describe("connexion", () => {
  it("n'impose pas la règle de longueur aux mots de passe existants", () => {
    expect(errorsOf(signInSchema, { email: "a@example.test", password: "court" })).toEqual({});
  });

  it("exige un mot de passe", () => {
    expect(errorsOf(signInSchema, { email: "a@example.test", password: "" })).toEqual({
      password: "required",
    });
  });
});

describe("mot de passe oublié et réinitialisation", () => {
  it("valide l'adresse", () => {
    expect(errorsOf(forgotPasswordSchema, { email: "x" })).toEqual({ email: "emailInvalid" });
  });

  it("exige deux saisies identiques", () => {
    expect(
      errorsOf(resetPasswordSchema, {
        password: "une phrase 42",
        confirmPassword: "une phrase 43",
      }),
    ).toEqual({ confirmPassword: "passwordMismatch" });
    expect(
      errorsOf(resetPasswordSchema, {
        password: "une phrase 42",
        confirmPassword: "une phrase 42",
      }),
    ).toEqual({});
  });
});

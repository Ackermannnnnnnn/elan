/** Chemins de l'application. Les libellés affichés sont traduits, pas les URL. */
export const ROUTES = {
  home: "/",
  nutrition: "/nutrition",
  training: "/training",
  trainingSetup: "/training/setup",
  trainingHistory: "/training/history",
  progress: "/progress",
  profile: "/profile",
  profileEdit: "/profile/edit",
  profileTargets: "/profile/targets",
  onboarding: "/onboarding",
  nutritionAdd: "/nutrition/add",
  foods: "/nutrition/foods",
  foodNew: "/nutrition/foods/new",
  foodScan: "/nutrition/foods/scan",
  recipes: "/nutrition/recipes",
  recipeNew: "/nutrition/recipes/new",
  mealPlan: "/nutrition/plan",
  shopping: "/nutrition/shopping",
  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  authConfirm: "/auth/confirm",
  setup: "/setup",
} as const;

/** Pages accessibles sans être connecté. */
export const PUBLIC_PATHS: readonly string[] = [
  ROUTES.login,
  ROUTES.signup,
  ROUTES.forgotPassword,
  ROUTES.authConfirm,
];

/** Pages d'authentification qu'un utilisateur déjà connecté n'a pas à revoir. */
export const GUEST_ONLY_PATHS: readonly string[] = [
  ROUTES.login,
  ROUTES.signup,
  ROUTES.forgotPassword,
];

/**
 * N'accepte qu'un chemin interne comme destination de redirection.
 * Bloque les redirections ouvertes (`//evil.test`, `https://…`, `/\evil`).
 */
export function safeRedirectPath(candidate: string | null | undefined): string {
  if (!candidate) return ROUTES.home;
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return ROUTES.home;
  }
  if (/[\u0000-\u001f]/.test(candidate)) return ROUTES.home;
  return candidate;
}

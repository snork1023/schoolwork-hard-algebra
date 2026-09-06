export const SIGNUP_IN_PROGRESS_KEY = "kepler-signup-in-progress";

export const isSignupInProgress = () =>
  typeof window !== "undefined" && sessionStorage.getItem(SIGNUP_IN_PROGRESS_KEY) === "true";
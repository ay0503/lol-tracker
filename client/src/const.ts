export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Login URL now points to the local login page instead of Manus OAuth
export const getLoginUrl = (returnPath?: string) => {
  if (returnPath) {
    return `/login?returnTo=${encodeURIComponent(returnPath)}`;
  }
  return "/login";
};

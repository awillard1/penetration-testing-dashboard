import type { AuthUser } from "../api/client";

export type AppUser = AuthUser | null | undefined;

const OPERATOR_ROLES = new Set<AuthUser["role"]>(["admin", "penetration_tester"]);
const REVIEWER_ROLES = new Set<AuthUser["role"]>(["admin", "penetration_tester", "reviewer"]);

export function canViewDashboard(user: AppUser) {
  return !!user && OPERATOR_ROLES.has(user.role);
}

export function canManageEngagements(user: AppUser) {
  return !!user && OPERATOR_ROLES.has(user.role);
}

export function canRunCommands(user: AppUser) {
  return !!user && OPERATOR_ROLES.has(user.role);
}

export function canViewCredentials(user: AppUser) {
  return !!user && OPERATOR_ROLES.has(user.role);
}

export function canRevealSecrets(user: AppUser) {
  return !!user && OPERATOR_ROLES.has(user.role);
}

export function canManageRunners(user: AppUser) {
  return !!user && OPERATOR_ROLES.has(user.role);
}

export function canReviewFindings(user: AppUser) {
  return !!user && REVIEWER_ROLES.has(user.role);
}

export function canRetest(user: AppUser) {
  return !!user && REVIEWER_ROLES.has(user.role);
}

export function canViewEvidence(user: AppUser) {
  return !!user && OPERATOR_ROLES.has(user.role);
}

export function canManageUsers(user: AppUser) {
  return !!user && user.role === "admin";
}

export function homePathForUser(user: AppUser) {
  if (canViewDashboard(user)) return "/dashboard";
  if (canReviewFindings(user)) return "/review";
  return "/findings";
}

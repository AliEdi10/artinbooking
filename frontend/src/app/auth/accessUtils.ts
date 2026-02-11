export function isAllowedRole(allowedRoles: string[] | undefined, userRole: string | undefined): boolean {
  if (!allowedRoles || allowedRoles.length === 0) return false;
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
}

export function shouldRedirectToLogin(loading: boolean, token: string | null): boolean {
  return !loading && !token;
}


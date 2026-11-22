/**
 * Safari asks the user for each site, even for hosts listed in the manifest.
 * Chrome grants them at install, so on Chrome everything here is a no-op.
 */
export const PORTAL_ORIGINS = ["https://student.emu.edu.tr/*", "https://students.emu.edu.tr/*"];

/** The portal origin a page belongs to, or null for any other page. */
export function portalOriginOf(url: string | undefined): string | null {
  const host = /^https:\/\/(students?\.emu\.edu\.tr)\//i.exec(url ?? "")?.[1]?.toLowerCase();
  return host ? `https://${host}/*` : null;
}

/**
 * Whether the extension may run on the portal. With an origin, only that host
 * counts; without one, any portal host is enough (students use one of the two).
 * A browser without the permissions API needs no grant.
 */
export async function hasPortalAccess(origin?: string): Promise<boolean> {
  const permissions = browser.permissions;
  if (!permissions) return true;
  try {
    for (const candidate of origin ? [origin] : PORTAL_ORIGINS) {
      if (await permissions.contains({ origins: [candidate] })) return true;
    }
    return false;
  } catch {
    return true;
  }
}

/** Badge shown on the toolbar button until the portal is allowed, so people see where to tap. */
export const MISSING_ACCESS_BADGE = "!";
export const MISSING_ACCESS_BADGE_COLOR = "#f12e4b";
export const MISSING_ACCESS_TITLE = "EMU LabMarker · Portal izni gerekiyor";
export const DEFAULT_TITLE = "EMU LabMarker";

/** Shows or clears the badge on the toolbar button to match the current access. */
export async function updateAccessBadge(): Promise<void> {
  const granted = await hasPortalAccess();
  const action = browser.action;
  if (!action) return;
  try {
    await action.setBadgeText({ text: granted ? "" : MISSING_ACCESS_BADGE });
    if (!granted) await action.setBadgeBackgroundColor?.({ color: MISSING_ACCESS_BADGE_COLOR });
    await action.setTitle?.({ title: granted ? DEFAULT_TITLE : MISSING_ACCESS_TITLE });
  } catch {
    // A browser without badges keeps the plain button.
  }
}

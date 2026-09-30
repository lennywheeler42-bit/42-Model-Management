// Public agency details used across the website.
export const CONTACT_EMAIL = "lenny@42modelmanagement.com";

// "Join us" stays on GoHighLevel; submissions flow back via /api/integrations/ghl.
export const JOIN_URL = "https://funnel.modelluxemedia.com/registration-form";

// The agency's home time zone: calendar days and exports are bucketed in it.
export const AGENCY_TIME_ZONE = "America/Chicago";

// The site's public origin from NEXT_PUBLIC_SITE_URL, e.g. "https://www.example.com".
// Tolerates a missing scheme, a trailing slash or a path; returns null when unset
// or not a valid http(s) address, so a bad setting can never break the build.
export function siteOrigin(value = process.env.NEXT_PUBLIC_SITE_URL): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

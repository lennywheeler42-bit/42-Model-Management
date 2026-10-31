// Public agency details used across the website.
export const CONTACT_EMAIL = "lenny@42modelmanagement.com";

// "Join us" stays on GoHighLevel; submissions flow back via /api/integrations/ghl.
export const JOIN_URL = "https://funnel.modelluxemedia.com/registration-form";

// Home page media, from the agency's own sources only (owner instruction):
// * The hero film is the agency's Vimeo video 1200406710, as on 42modelmanagement.com.
//   Its player embed is locked to that domain, so the public file link is used;
//   it redirects to vimeocdn.com (allowed in the CSP, next.config.ts).
// * Photos are B-roll from the agency Google Drive ("42ModelManagement/B-Roll Footage"),
//   resized into public/media. Dashboard → Website → Settings images still win.
export const HERO_VIDEO_URL = "https://player.vimeo.com/progressive_redirect/playback/1200406710/rendition/360p/file.mp4%20%28360p%29.mp4?loc=external&signature=ce1a2d371ad49347e01104ae5305130b6c88e1f1c7907a83c81945a7c8c08dfe";
export const SITE_MEDIA = {
  hero: "/media/hero.jpg",
  about: "/media/about.jpg",
  editorial: ["/media/editorial-1.jpg", "/media/editorial-2.jpg", "/media/editorial-3.jpg", "/media/editorial-4.jpg", "/media/editorial-5.jpg"],
};

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

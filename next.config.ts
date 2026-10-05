import type { NextConfig } from "next";

// Published talent and CMS images are served from Supabase public storage buckets.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;
const supabaseHost = supabaseUrl?.hostname ?? null;
const supabaseOrigin = supabaseUrl?.origin ?? "";
const isDev = process.env.NODE_ENV === "development";

// Content-Security-Policy without nonces, so static pages keep working (Next.js
// CSP guide, "Without Nonces"). Scripts only from this site; inline scripts are
// allowed because Next.js needs them, and CMS HTML is sanitised so no content
// can add script. Images, uploads and auth talk to Supabase only; frames only
// for YouTube/Vimeo embeds; this site can never be framed by others.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin}`.trim(),
  `media-src 'self' blob: ${supabaseOrigin}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseOrigin.replace(/^https:/, "wss:")}${isDev ? " ws:" : ""}`.replace(/\s+/g, " ").trim(),
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

// Security headers for every response. The camera is allowed for this site only
// (talent can take digitals straight from the portal).
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Rendered in Node route handlers (PDF comp cards); not bundled.
  serverExternalPackages: ["@react-pdf/renderer"],
  images: {
    remotePatterns: [
      ...(supabaseHost ? [{ protocol: "https" as const, hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }] : []),
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Signed-in pages must never be stored by shared caches.
      { source: "/(dashboard|portal|preview|login)/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
      // CDS Import opens CDS / WebForFashion in a popup and receives data from it
      // by postMessage, so it keeps its opener link to popups (later rule wins).
      { source: "/dashboard/cds", headers: [{ key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" }] },
      // Client package links: private, never indexed or cached.
      { source: "/p/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
};

export default nextConfig;

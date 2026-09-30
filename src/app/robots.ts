import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const site = siteOrigin() ?? "http://localhost:3000";
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/portal", "/preview/", "/api/", "/login", "/auth/", "/p/"] },
    sitemap: `${site}/sitemap.xml`,
  };
}

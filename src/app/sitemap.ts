import type { MetadataRoute } from "next";
import { getSitemapEntries } from "@/features/public/queries";

export const dynamic = "force-dynamic";

// Only published boards and talent: the public views never return drafts,
// archived, or internal records, so they cannot leak into the sitemap.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const { boards, talent } = await getSitemapEntries();
  return [
    { url: `${site}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/models`, changeFrequency: "daily", priority: 0.9 },
    ...boards.map((board) => ({ url: `${site}/models/${board.path}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...talent.map((item) => ({ url: `${site}/models/${item.slug}`, lastModified: item.updated_at, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}

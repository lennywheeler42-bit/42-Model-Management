import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState, UnauthorizedState } from "@/components/ui/States";
import { requirePage } from "@/lib/agency-auth";
import { log } from "@/lib/log";
import { galleryPhotos, publicStats } from "@/features/compcard/build";
import { CompCardBuilder } from "@/features/compcard/CompCardBuilder";
import { photoUrls } from "@/features/media/urls";

export const metadata = { title: "Comp card" };

export default async function CompCardPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requirePage(["talent.view", "media.view"]);
  if (!context) return <UnauthorizedState />;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = context;
  let data: { talent: { id: string; display_name: string; location: string | null; gender: string | null; show_measurements: boolean }; photos: Awaited<ReturnType<typeof galleryPhotos>>; urls: Map<string, string>; stats: Awaited<ReturnType<typeof publicStats>> } | null;
  try {
    const { data: talent } = await supabase.from("talent").select("id,display_name,location,gender,show_measurements").eq("id", id).maybeSingle();
    const photos = talent ? await galleryPhotos(supabase, id) : [];
    data = talent ? { talent, photos, urls: await photoUrls(supabase, photos), stats: await publicStats(supabase, id, talent.gender) } : null;
  } catch (error) {
    log.error("compcard", "load failed", error);
    return <ErrorState title="The comp card could not be prepared" />;
  }
  if (!data) notFound();

  return <div className="space-y-6">
    <Link href={`/dashboard/talent/${id}?tab=media`} className="inline-flex items-center gap-2 text-xs text-[#6b6d66] hover:text-[#20211f]"><ArrowLeft size={14} aria-hidden />Back to media</Link>
    <PageHeader eyebrow="Comp card" title={data.talent.display_name} description="Two-sided 5.5 × 8.5 in card with agency contact details only. Private contact and legal details are never included." />
    <CompCardBuilder talentId={id} name={data.talent.display_name} location={data.talent.location}
      photos={data.photos.map((photo) => ({ id: photo.id, url: data!.urls.get(photo.id) ?? "", alt: photo.alt_text || data!.talent.display_name, public: photo.public, cropped: Boolean(photo.cropped_path) }))}
      stats={data.stats} measurementsAllowed={data.talent.show_measurements} />
  </div>;
}

import { NextResponse } from "next/server";
import { databaseError, writeAudit } from "@/lib/api";
import { requireApi } from "@/lib/agency-auth";
import { refreshPublicSite } from "@/features/public/cache";

// Puts a talent on the website in one step, for the Website check page: the
// portfolios and digital books that hold a photo shown on the website become public,
// then the talent is published. The photos are shown first with media/publish-all.
// A talent with no photo on the website is refused: there would be nothing to show.
// RLS and the publication trigger enforce the same permissions and write the audit.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Talent not found" }, { status: 404 });
  const auth = await requireApi(["talent.publish", "media.manage"]);
  if ("response" in auth) return auth.response;
  const { supabase } = auth.context;

  const [talent, photos] = await Promise.all([
    supabase.from("talent").select("id,publication_status,show_on_website,archived_at").eq("id", id).maybeSingle(),
    supabase.from("talent_photos").select("id").eq("talent_id", id).eq("public", true).not("public_storage_path", "is", null).is("archived_at", null).limit(1000),
  ]);
  if (talent.error || photos.error) return databaseError(talent.error ?? photos.error, "load the talent");
  if (!talent.data || talent.data.archived_at || talent.data.publication_status === "archived") return NextResponse.json({ error: "Talent not found" }, { status: 404 });
  const shown = (photos.data ?? []).map((photo) => photo.id as string);
  if (!shown.length) return NextResponse.json({ error: "No photo on the website yet, so there is nothing to show.", code: "no_photo" }, { status: 422 });

  // Collections with at least one photo that is on the website.
  const [portfolios, books] = await Promise.all([
    supabase.from("portfolios").select("id,portfolio_images(photo_id)").eq("talent_id", id).eq("public", false),
    supabase.from("digital_books").select("id,digital_book_images(photo_id)").eq("talent_id", id).eq("public", false),
  ]);
  if (portfolios.error || books.error) return databaseError(portfolios.error ?? books.error, "load the portfolios");
  const onWebsite = new Set(shown);
  const holdsShown = (images: { photo_id: string }[] | null) => (images ?? []).some((image) => onWebsite.has(image.photo_id));
  const portfolioIds = ((portfolios.data ?? []) as { id: string; portfolio_images: { photo_id: string }[] }[]).filter((row) => holdsShown(row.portfolio_images)).map((row) => row.id);
  const bookIds = ((books.data ?? []) as { id: string; digital_book_images: { photo_id: string }[] }[]).filter((row) => holdsShown(row.digital_book_images)).map((row) => row.id);
  const now = new Date().toISOString();
  if (portfolioIds.length) {
    const { error } = await supabase.from("portfolios").update({ public: true }).in("id", portfolioIds).eq("talent_id", id);
    if (error) return databaseError(error, "show the portfolios");
  }
  if (bookIds.length) {
    const { error } = await supabase.from("digital_books").update({ public: true, published_at: now }).in("id", bookIds).eq("talent_id", id);
    if (error) return databaseError(error, "show the digitals");
  }

  const alreadyLive = talent.data.publication_status === "published" && talent.data.show_on_website;
  if (!alreadyLive) {
    const { error } = await supabase.from("talent").update({ publication_status: "published", show_on_website: true }).eq("id", id).select("id").single();
    if (error?.code === "42501") return NextResponse.json({ error: error.message }, { status: 403 });
    if (error) return databaseError(error, "publish the talent");
  }
  refreshPublicSite();
  if (portfolioIds.length || bookIds.length) await writeAudit(supabase, { action: "media.collections_published", entityType: "talent", entityId: id, metadata: { portfolios: portfolioIds.length, digital_books: bookIds.length } });
  return NextResponse.json({ published: !alreadyLive, portfolios: portfolioIds.length, digital_books: bookIds.length });
}

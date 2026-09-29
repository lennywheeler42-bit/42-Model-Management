import { NextResponse } from "next/server";
import { z } from "zod";
import { databaseError, writeAudit } from "@/lib/api";
import { canManageTalent, getAgencyContext } from "@/lib/agency-auth";

const schema = z.object({ public: z.boolean() });

// Promotes a private photo to the public bucket (or withdraws it). Only promoted
// copies are ever served to the website; the private original is preserved.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const { id, photoId } = await params;
  const context = await getAgencyContext();
  if (!context.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!context.authorized || !canManageTalent(context.membership?.role)) return NextResponse.json({ error: "Talent management access required" }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid media update" }, { status: 400 });

  const { supabase } = context;
  const { data: photo, error } = await supabase.from("talent_photos").select("id,storage_path,storage_bucket,public_storage_path").eq("id", photoId).eq("talent_id", id).maybeSingle();
  if (error) return databaseError(error, "load the media record");
  if (!photo) return NextResponse.json({ error: "Media not found" }, { status: 404 });

  let publicPath: string | null = photo.public_storage_path;
  if (parsed.data.public && !publicPath) {
    if (photo.storage_bucket === "talent-public") {
      publicPath = photo.storage_path;
    } else {
      publicPath = `talent/${id}/${photo.id}-${photo.storage_path.split("/").pop()}`;
      const copy = await supabase.storage.from("talent-private").copy(photo.storage_path, publicPath, { destinationBucket: "talent-public" });
      if (copy.error) return databaseError(copy.error, "publish this image");
    }
  }
  if (!parsed.data.public && publicPath && photo.storage_bucket === "talent-private") {
    const removal = await supabase.storage.from("talent-public").remove([publicPath]);
    if (removal.error) return databaseError(removal.error, "withdraw this image");
    publicPath = null;
  }

  const { data, error: updateError } = await supabase.from("talent_photos")
    .update({ public: parsed.data.public, publish_to_website: parsed.data.public, public_storage_path: publicPath })
    .eq("id", photo.id).select("id,storage_path,title,alt_text,photographer,image_type,display_order,featured,public,publish_to_website").single();
  if (updateError) return databaseError(updateError, "update the media record");

  await writeAudit(supabase, { action: parsed.data.public ? "media.published" : "media.unpublished", entityType: "talent", entityId: id, metadata: { photo_id: photo.id } });
  return NextResponse.json(data);
}

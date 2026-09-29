import { NextResponse } from "next/server";
import { displayNameForUser, getAgencyContext } from "@/lib/agency-auth";

export async function GET() {
  const context = await getAgencyContext();
  if (!context.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!context.authorized || !context.membership) {
    return NextResponse.json({ error: "Your account is not approved for the agency dashboard" }, { status: 403 });
  }

  return NextResponse.json({
    email: context.user.email,
    name: displayNameForUser(context.user, context.profile),
    role: context.membership.role,
    avatarUrl: typeof context.user.user_metadata?.avatar_url === "string" ? context.user.user_metadata.avatar_url : null,
  });
}

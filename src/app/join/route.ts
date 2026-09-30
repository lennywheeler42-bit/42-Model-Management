import { NextResponse } from "next/server";
import { JOIN_URL } from "@/lib/site";

// /join is the address to share; the form itself is hosted on GoHighLevel.
export function GET() {
  return NextResponse.redirect(JOIN_URL, 307);
}

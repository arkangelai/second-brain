import { resolveRequestPrincipal } from "@/lib/auth/principal";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const principal = await resolveRequestPrincipal(request);

  if (!principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ principal });
}

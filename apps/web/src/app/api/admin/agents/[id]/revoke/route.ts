import { NextResponse } from "next/server";

import {
  getAdminAgentsContext,
  RequestError,
  revokeAgent,
} from "@/lib/admin-agents-store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = getAdminAgentsContext(request);
    const { id } = await params;
    const agent = await revokeAgent(context, id);

    return NextResponse.json({ agent });
  } catch (error) {
    if (error instanceof RequestError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error(error);
    return NextResponse.json(
      { error: "Unexpected revoke error." },
      { status: 500 }
    );
  }
}

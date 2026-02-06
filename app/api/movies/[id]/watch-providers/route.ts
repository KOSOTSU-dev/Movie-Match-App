import { getMovieWatchProviders } from "@/lib/tmdb";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = Number((await params).id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid movie id" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const region = searchParams.get("region") || "JP";

  const providers = await getMovieWatchProviders(id, { region });
  return NextResponse.json({ providers });
}

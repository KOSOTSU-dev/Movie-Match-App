import { getMovieVideos } from "@/lib/tmdb";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = Number((await params).id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid movie id" }, { status: 400 });
  }

  const key = await getMovieVideos(id);
  return NextResponse.json({ key });
}

import { NextRequest, NextResponse } from "next/server";

const TMDB_API_BASE_URL = process.env.NEXT_PUBLIC_TMDB_API_BASE_URL ?? process.env.TMDB_API_BASE_URL ?? "https://api.themoviedb.org/3";
const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY ?? process.env.TMDB_API_KEY;

export async function GET(request: NextRequest) {
  try {
    if (!TMDB_API_KEY) {
      return NextResponse.json({ error: "TMDB_API_KEY is not set" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const region = searchParams.get("region") || "JP";

    // TMDB APIのベースURLが正しく設定されているか確認
    const baseUrl = TMDB_API_BASE_URL.replace(/\/$/, "").endsWith("/3")
      ? TMDB_API_BASE_URL.replace(/\/$/, "")
      : `${TMDB_API_BASE_URL.replace(/\/$/, "")}/3`;
    const url = `${baseUrl}/watch/providers/movie?watch_region=${region}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${TMDB_API_KEY}`,
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      return NextResponse.json({ error: `TMDB API error: ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    
    // Netflix, Amazon Prime Video, Disney+, U-NEXTのIDを探す
    const providers = data.results || [];
    const targetProviders = providers.filter((p: any) => 
      p.provider_name?.toLowerCase().includes("netflix") ||
      p.provider_name?.toLowerCase().includes("amazon") ||
      p.provider_name?.toLowerCase().includes("prime") ||
      p.provider_name?.toLowerCase().includes("disney") ||
      p.provider_name?.toLowerCase().includes("unext") ||
      p.provider_name?.toLowerCase().includes("u-next")
    );

    return NextResponse.json({
      region,
      providers: targetProviders.map((p: any) => ({
        id: p.provider_id,
        name: p.provider_name,
        logo_path: p.logo_path
      })),
      allProviders: providers.map((p: any) => ({
        id: p.provider_id,
        name: p.provider_name
      }))
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

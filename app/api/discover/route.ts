import { discoverMovies, type TmdbMovie } from "@/lib/tmdb";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const watchProviderIds = searchParams.get("watchProviderIds");
    const genreIds = searchParams.get("genreIds");

    const providerList = watchProviderIds
      ? watchProviderIds.split(",").filter(Boolean)
      : undefined;
    const genreList = genreIds ? genreIds.split(",").filter(Boolean) : undefined;
    const pageParam = searchParams.get("page");
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) || 1 : 1;

    // Prime Video(119)のみの場合は ID 9 も併用して結果を増やす
    // Netflix(8)のみの場合は lib/tmdb 側で watch_region=US を使って取得するため、ここでは拡張しない
    const effectiveProviderList =
      providerList?.length === 1 && providerList[0] === "119"
        ? ["119", "9"]
        : providerList;

    let res: Awaited<ReturnType<typeof discoverMovies>>;

    // プロバイダーが選択されている場合、各プロバイダーで個別にリクエストして結果をマージ
    if (effectiveProviderList && effectiveProviderList.length > 0) {
      // eslint-disable-next-line no-console
      console.log("[discover] Providers selected, fetching individually and merging:", effectiveProviderList, "page:", page);

      const results = await Promise.all(
        effectiveProviderList.map(async (providerId) => {
          try {
            const result = await discoverMovies({
              watchProviderIds: [providerId],
              genreIds: genreList,
              page
            });
            // eslint-disable-next-line no-console
            console.log(`[discover] Provider ${providerId} returned ${result.results.length} results`);
            return result;
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(`[discover] Provider ${providerId} error:`, error);
            return { results: [], page: 1, total_pages: 0, total_results: 0 };
          }
        })
      );

      // 結果をマージして重複を除去（IDで重複チェック）
      const movieMap = new Map<number, TmdbMovie>();
      for (const result of results) {
        for (const movie of result.results) {
          if (!movieMap.has(movie.id)) {
            movieMap.set(movie.id, movie);
          }
        }
      }

      res = {
        page: 1,
        results: Array.from(movieMap.values()),
        total_pages: 1,
        total_results: movieMap.size
      };

      // eslint-disable-next-line no-console
      console.log("[discover] Merged results count:", res.results.length);
    } else {
      // プロバイダーなしの場合
      res = await discoverMovies({
        watchProviderIds: providerList,
        genreIds: genreList,
        page
      });

      // eslint-disable-next-line no-console
      console.log("[discover] TMDB results count:", res.results?.length ?? 0);
    }

    // 結果が0件の場合、フィルターなしで再取得して表示できるようにする
    if ((res.results?.length ?? 0) === 0) {
      const hadFilters = (providerList?.length ?? 0) > 0 || (genreList?.length ?? 0) > 0;
      if (page > 1) {
        return NextResponse.json(res);
      }
      // eslint-disable-next-line no-console
      console.log("[discover] No results found, attempting fallback (no filters)", { hadFilters, providerList, genreList });
      
      if (hadFilters) {
        // フィルターがあった場合、フォールバックを実行（page を渡す）
        res = await discoverMovies({ page });
        const fallbackCount = res.results?.length ?? 0;
        // eslint-disable-next-line no-console
        console.log("[discover] Fallback (no filter) results count:", fallbackCount);
        return NextResponse.json({
          ...res,
          _fallbackUsed: true // フィルターがあった場合は常にtrue（結果が0件でも）
        });
      }
      
      // フィルターがない場合はそのまま返す
      return NextResponse.json(res);
    }

    return NextResponse.json(res);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    // eslint-disable-next-line no-console
    console.error("[discover] Error:", message);
    return NextResponse.json(
      { error: message },
      { status: message.includes("レート制限") ? 429 : 500 }
    );
  }
}

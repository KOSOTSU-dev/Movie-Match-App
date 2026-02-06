// TMDB API v3 のベースURL（必ず末尾が /3 になるように補正）
const rawBase =
  process.env.NEXT_PUBLIC_TMDB_API_BASE_URL ??
  process.env.TMDB_API_BASE_URL ??
  "https://api.themoviedb.org/3";
const TMDB_API_BASE_URL = rawBase.replace(/\/$/, "").endsWith("/3")
  ? rawBase.replace(/\/$/, "")
  : `${rawBase.replace(/\/$/, "")}/3`;
const TMDB_API_KEY =
  process.env.NEXT_PUBLIC_TMDB_API_KEY ?? process.env.TMDB_API_KEY;

if (!TMDB_API_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    "TMDB_API_KEY が設定されていません。TMDB からデータ取得ができません。"
  );
}

export type TmdbMovie = {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  vote_average: number;
  genre_ids: number[];
  video_key?: string; // YouTube動画のキー
};

type DiscoverMovieResponse = {
  page: number;
  results: TmdbMovie[];
  total_pages: number;
  total_results: number;
};

export async function getMovieDetails(movieId: number): Promise<TmdbMovie | null> {
  if (!TMDB_API_KEY) {
    return null;
  }

  try {
    const url = `${TMDB_API_BASE_URL}/movie/${movieId}?language=ja-JP`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${TMDB_API_KEY}`,
        "Content-Type": "application/json"
      },
      next: { revalidate: 3600 }
    });

    if (!res.ok) {
      return null;
    }

    const text = await res.text();
    if (!text || text.trim() === "") {
      return null;
    }

    const data = JSON.parse(text) as TmdbMovie;
    return data;
  } catch {
    return null;
  }
}

export async function discoverMovies(params: {
  watchProviderIds?: string[];
  genreIds?: string[];
  page?: number;
}) {
  if (!TMDB_API_KEY) {
    throw new Error("TMDB_API_KEY is not set");
  }

  const searchParams = new URLSearchParams();
  searchParams.set("sort_by", "popularity.desc");
  searchParams.set("language", "ja-JP");
  searchParams.set("page", String(params.page ?? 1));

  if (params.watchProviderIds?.length) {
    // TMDB APIでは、複数のプロバイダーIDを|で区切るとOR条件として動作します
    // しかし、実際には各プロバイダーで個別にリクエストしてマージする方が確実です
    searchParams.set(
      "with_watch_providers",
      params.watchProviderIds.join("|")
    );
    // Netflix(8)のみの場合はTMDBの日本データが少ないため、米国(US)の登録情報を使う
    const isNetflixOnly =
      params.watchProviderIds.length === 1 && params.watchProviderIds[0] === "8";
    searchParams.set("watch_region", isNetflixOnly ? "US" : "JP");

    // デバッグ: プロバイダーIDをログ出力
    // eslint-disable-next-line no-console
    console.log(`[tmdb] discover/movie with providers: ${params.watchProviderIds.join(',')}, region: ${isNetflixOnly ? "US" : "JP"}`);
  }

  if (params.genreIds?.length) {
    searchParams.set("with_genres", params.genreIds.join(","));
  }

  const url = `${TMDB_API_BASE_URL}/discover/movie?${searchParams.toString()}`;
  
  // デバッグ: リクエストURLをログ出力（プロバイダーIDが含まれる場合）
  if (params.watchProviderIds?.length) {
    // eslint-disable-next-line no-console
    console.log(`[tmdb] discover/movie request URL: ${url.replace(TMDB_API_KEY || '', '[API_KEY]')}`);
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TMDB_API_KEY}`,
      "Content-Type": "application/json"
    },
    next: { revalidate: 60 }
  });

  if (!res.ok) {
    const statusText = res.statusText || `HTTP ${res.status}`;
    if (res.status === 429) {
      throw new Error("TMDB APIのレート制限に達しました。しばらく時間をおいてから再度お試しください。");
    }
    if (res.status === 401) {
      throw new Error("TMDB APIキーが無効です。環境変数 TMDB_API_KEY を確認してください。");
    }
    throw new Error(`TMDB APIエラー: ${statusText}`);
  }

  const text = await res.text();
  if (!text || text.trim() === '') {
    // 空レスポンス（レート制限や一時的な不具合の可能性）は空の結果を返し、クラッシュを防ぐ
    // eslint-disable-next-line no-console
    console.warn(`[tmdb] discover/movie: empty response (status=${res.status}). URL had key: ${!!TMDB_API_KEY}`);
    return {
      page: 1,
      results: [],
      total_pages: 0,
      total_results: 0
    };
  }

  let data: DiscoverMovieResponse;
  try {
    data = JSON.parse(text) as DiscoverMovieResponse;
    
    // デバッグ: プロバイダーIDが含まれる場合、結果件数をログ出力
    if (params.watchProviderIds?.length) {
      // eslint-disable-next-line no-console
      console.log(`[tmdb] discover/movie response: total_results=${data.total_results}, results.length=${data.results.length}, providerIds=${params.watchProviderIds.join(',')}`);
    }
  } catch (parseError) {
    // eslint-disable-next-line no-console
    console.error('Failed to parse discover movies response:', parseError, 'Response:', text.substring(0, 200));
    // パース失敗時も空の結果を返してクラッシュを防ぐ
    return {
      page: 1,
      results: [],
      total_pages: 0,
      total_results: 0
    };
  }

  return data;
}

type TmdbVideoResponse = {
  id: number;
  results: Array<{
    id: string;
    key: string;
    name: string;
    site: string;
    type: string;
  }>;
};

function pickVideoKey(results: TmdbVideoResponse["results"]): string | null {
  const trailer = results.find(
    (v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser")
  );
  if (trailer) return trailer.key;
  const youtubeVideo = results.find((v) => v.site === "YouTube");
  return youtubeVideo?.key ?? null;
}

export async function getMovieVideos(movieId: number): Promise<string | null> {
  if (!TMDB_API_KEY) {
    return null;
  }

  const fetchVideos = async (lang: string) => {
    const url = `${TMDB_API_BASE_URL}/movie/${movieId}/videos?language=${lang}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${TMDB_API_KEY}`,
        "Content-Type": "application/json"
      },
      next: { revalidate: 3600 }
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text?.trim()) return null;
    try {
      const data = JSON.parse(text) as TmdbVideoResponse;
      return { results: data.results ?? [] };
    } catch {
      return null;
    }
  };

  try {
    const ja = await fetchVideos("ja-JP");
    const keyJa = ja ? pickVideoKey(ja.results) : null;
    if (keyJa) return keyJa;
    const en = await fetchVideos("en-US");
    const keyEn = en ? pickVideoKey(en.results) : null;
    return keyEn ?? null;
  } catch {
    return null;
  }
}

export type WatchProvider = {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  link?: string;
};

type TmdbWatchProvidersResponse = {
  id: number;
  results: {
    JP?: {
      link: string;
      flatrate?: Array<{
        logo_path: string;
        provider_id: number;
        provider_name: string;
      }>;
      rent?: Array<{
        logo_path: string;
        provider_id: number;
        provider_name: string;
      }>;
      buy?: Array<{
        logo_path: string;
        provider_id: number;
        provider_name: string;
      }>;
    };
  };
};

export async function getMovieWatchProviders(
  movieId: number,
  options?: { region?: string }
): Promise<WatchProvider[] | null> {
  if (!TMDB_API_KEY) {
    return null;
  }

  try {
    const url = `${TMDB_API_BASE_URL}/movie/${movieId}/watch/providers`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${TMDB_API_KEY}`,
        "Content-Type": "application/json"
      },
      next: { revalidate: 3600 } // 1時間キャッシュ
    });

    if (!res.ok) {
      if (res.status === 429) {
        // eslint-disable-next-line no-console
        console.warn('TMDB API rate limit reached for watch providers');
      }
      return null;
    }

    const text = await res.text();
    if (!text || text.trim() === '') {
      return null;
    }

    let data: TmdbWatchProvidersResponse;
    try {
      data = JSON.parse(text) as TmdbWatchProvidersResponse;
    } catch (parseError) {
      // eslint-disable-next-line no-console
      console.error('Failed to parse watch providers response:', parseError);
      return null;
    }
    const region = options?.region ?? "JP";
    const regionProviders = data.results[region as keyof typeof data.results] ?? data.results.JP;

    if (!regionProviders) {
      return null;
    }

    // flatrate（サブスクリプション）を優先的に取得
    const providers: WatchProvider[] = [];

    if (regionProviders.flatrate) {
      regionProviders.flatrate.forEach((provider) => {
        providers.push({
          provider_id: provider.provider_id,
          provider_name: provider.provider_name,
          logo_path: provider.logo_path,
          link: regionProviders.link
        });
      });
    }

    // レンタル/購入も追加（重複を避ける）
    const existingIds = new Set(providers.map((p) => p.provider_id));

    if (regionProviders.rent) {
      regionProviders.rent.forEach((provider) => {
        if (!existingIds.has(provider.provider_id)) {
          providers.push({
            provider_id: provider.provider_id,
            provider_name: provider.provider_name,
            logo_path: provider.logo_path,
            link: regionProviders.link
          });
          existingIds.add(provider.provider_id);
        }
      });
    }

    if (regionProviders.buy) {
      regionProviders.buy.forEach((provider) => {
        if (!existingIds.has(provider.provider_id)) {
          providers.push({
            provider_id: provider.provider_id,
            provider_name: provider.provider_name,
            logo_path: provider.logo_path,
            link: regionProviders.link
          });
        }
      });
    }

    return providers.length > 0 ? providers : null;
  } catch {
    return null;
  }
}

"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import type { TmdbMovie, WatchProvider } from "@/lib/tmdb";
import { SwipeCard } from "@/components/SwipeCard";
import { Header } from "@/components/Header";
import { getOneLineSynopsis } from "@/lib/synopsis";
import Link from "next/link";

type LikeStatus = "like" | "bad";

export default function DiscoverPage() {
  const { user, loading } = useAuth();
  const [movies, setMovies] = useState<TmdbMovie[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingMovies, setLoadingMovies] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [likedIds, setLikedIds] = useState<number[]>([]);
  const [badIds, setBadIds] = useState<number[]>([]);

  // 前回のmoviesの長さを追跡（useEffectの再実行時にcurrentIndexをリセットするかどうかを判断するため）
  const prevMoviesLengthRef = useRef<number>(0);
  const isSwipingRef = useRef<boolean>(false);
  // 背景動画のミュート状態を iframe onLoad で参照するため
  const isBackgroundMutedRef = useRef<boolean>(true);
  // 全画面のミュート状態を iframe onLoad で参照するため
  const isFullscreenMutedRef = useRef<boolean>(false);

  const [selectedProviders, setSelectedProviders] = useState<string[]>([
    "8" // Netflix (例)
  ]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [isProviderPanelOpen, setIsProviderPanelOpen] = useState(false);
  const [isGenrePanelOpen, setIsGenrePanelOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBackgroundMuted, setIsBackgroundMuted] = useState(true);
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);
  const [isFullscreenMuted, setIsFullscreenMuted] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [watchProviders, setWatchProviders] = useState<WatchProvider[] | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [isModalMuted, setIsModalMuted] = useState(true);
  /** AI要約あらすじのキャッシュ（movieId → 1行あらすじ） */
  const [synopsisCache, setSynopsisCache] = useState<Record<number, string>>({});
  /** モバイルでLIKE/BADボタン押下時のスワイプアニメーション用 */
  const [mobileSwipeTrigger, setMobileSwipeTrigger] = useState<"left" | "right" | null>(null);

  // TMDBジャンル定義
  const genres = [
    { id: "16", name: "アニメ" },
    { id: "18", name: "ドラマ" },
    { id: "28", name: "アクション" },
    { id: "35", name: "コメディ" },
    { id: "27", name: "ホラー" },
    { id: "878", name: "SF" },
    { id: "10749", name: "ロマンス" },
    { id: "53", name: "スリラー" },
    { id: "9648", name: "ミステリー" },
    { id: "14", name: "ファンタジー" },
    { id: "12", name: "アドベンチャー" },
    { id: "10752", name: "戦争" },
    { id: "37", name: "西部劇" },
    { id: "10402", name: "音楽" },
    { id: "10751", name: "家族" },
    { id: "99", name: "ドキュメンタリー" },
    { id: "36", name: "歴史" },
    { id: "80", name: "犯罪" }
  ];

  // デフォルトで表示するジャンル（アニメ、ドラマ、アクション）
  const defaultGenres = genres.slice(0, 3);
  const otherGenres = genres.slice(3);

  useEffect(() => {
    const storedProviders = window.localStorage.getItem(
      "mm_selected_providers"
    );
    const storedGenres = window.localStorage.getItem("mm_selected_genres");
    if (storedProviders) {
      setSelectedProviders(JSON.parse(storedProviders));
    }
    if (storedGenres) {
      setSelectedGenres(JSON.parse(storedGenres));
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "mm_selected_providers",
      JSON.stringify(selectedProviders)
    );
  }, [selectedProviders]);

  useEffect(() => {
    window.localStorage.setItem(
      "mm_selected_genres",
      JSON.stringify(selectedGenres)
    );
  }, [selectedGenres]);

  // フィルターパネルの外側クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        (isProviderPanelOpen || isGenrePanelOpen) &&
        !target.closest(".genre-dropdown-container") &&
        !target.closest(".provider-panel-trigger") &&
        !target.closest(".genre-panel-trigger")
      ) {
        setIsProviderPanelOpen(false);
        setIsGenrePanelOpen(false);
      }
    };

    if (isProviderPanelOpen || isGenrePanelOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isProviderPanelOpen, isGenrePanelOpen]);

  useEffect(() => {
    const fetchLikes = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from("likes")
        .select("tmdb_id,status")
        .eq("user_id", user.id);

      if (error) {
        // eslint-disable-next-line no-console
        console.error(error);
        return;
      }

      const liked: number[] = [];
      const bad: number[] = [];
      for (const row of data ?? []) {
        if (row.status === "like") liked.push(row.tmdb_id);
        if (row.status === "bad") bad.push(row.tmdb_id);
      }
      setLikedIds(liked);
      setBadIds(bad);
    };

    void fetchLikes();
  }, [user]);

  useEffect(() => {
    const shuffleFisherYates = <T,>(arr: T[]): T[] => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    const fetchMovies = async () => {
      if (!user) return;
      setLoadingMovies(true);
      setError(null);
      setFallbackMessage(null);
      try {
        const allResults: TmdbMovie[] = [];
        let fallbackUsed = false;
        const maxPages = 5;
        const minUnevaluated = 15;

        for (let page = 1; page <= maxPages; page++) {
          const params = new URLSearchParams();
          if (selectedProviders.length) params.set("watchProviderIds", selectedProviders.join(","));
          if (selectedGenres.length) params.set("genreIds", selectedGenres.join(","));
          params.set("page", String(page));
          // 再読み込み時にキャッシュをバイパスするためのパラメータ
          if (refreshTrigger > 0) params.set("_t", String(refreshTrigger));
          const res = await fetch(`/api/discover?${params.toString()}`, {
            cache: refreshTrigger > 0 ? "no-store" : "default"
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(typeof data.error === "string" ? data.error : "作品の取得に失敗しました。");
          }
          if (data._fallbackUsed) fallbackUsed = true;
          const pageResults = (data.results ?? []) as TmdbMovie[];
          if (pageResults.length === 0) break;
          for (const m of pageResults) {
            if (!allResults.some((r) => r.id === m.id)) allResults.push(m);
          }
          const unevaluated = allResults.filter(
            (m) => !likedIds.includes(m.id) && !badIds.includes(m.id)
          );
          if (unevaluated.length >= minUnevaluated) break;
        }

        // 既にLIKE/BADした作品は絶対に表示しない
        const filtered = allResults.filter(
          (m: TmdbMovie) => !likedIds.includes(m.id) && !badIds.includes(m.id)
        );
        const shuffled = shuffleFisherYates(filtered);

        setMovies(shuffled);
        setCurrentIndex((prev) => (prev >= shuffled.length ? 0 : prev));
        setFallbackMessage(
          fallbackUsed ? "選択した条件では作品が見つかりませんでした。人気の作品を表示しています。" : null
        );

        const initialPreloadCount = Math.min(4, shuffled.length);
        Promise.all(
          shuffled.slice(0, initialPreloadCount).map(async (movie: TmdbMovie) => {
            const vRes = await fetch(`/api/movies/${movie.id}/videos`);
            const vData = await vRes.json().catch(() => ({}));
            const videoKey = vData?.key ?? null;
            if (!videoKey) return;
            setMovies((prev) =>
              prev.map((m) =>
                m.id === movie.id ? { ...m, video_key: videoKey } : m
              )
            );
          })
        ).catch(() => {});
      } catch (e) {
        let errorMessage = "作品の取得中にエラーが発生しました。";
        if (e instanceof Error) {
          errorMessage = e.message;
          // レート制限の場合は追加の説明を表示
          if (e.message.includes("レート制限")) {
            errorMessage += " 通常、数分から数時間で自動的に回復します。";
          }
        }
        setError(errorMessage);
        // eslint-disable-next-line no-console
        console.error("Failed to fetch movies:", e);
      } finally {
        setLoadingMovies(false);
      }
    };

    void fetchMovies();
  }, [user, likedIds, badIds, selectedProviders, selectedGenres, refreshTrigger]);

  const currentMovie = useMemo(
    () => movies[currentIndex] ?? null,
    [movies, currentIndex]
  );

  // デスクトップ版の背景動画iframe参照（フックは条件分岐の前に定義）
  const backgroundVideoRef = useRef<HTMLIFrameElement>(null);
  // モーダル内の動画iframe参照
  const modalVideoRef = useRef<HTMLIFrameElement>(null);
  // 全画面動画iframe参照（postMessageでミュート切替するため）
  const fullscreenVideoRef = useRef<HTMLIFrameElement>(null);

  // デスクトップ版用の背景動画URL（常にミュートで読み込み→postMessageでミュート解除して再生位置を維持）
  const backgroundVideoUrl = currentMovie?.video_key
    ? `https://www.youtube.com/embed/${currentMovie.video_key}?autoplay=1&loop=1&playlist=${currentMovie.video_key}&controls=0&modestbranding=1&rel=0&mute=1&playsinline=1&enablejsapi=1&iv_load_policy=3&cc_load_policy=0&fs=0&showinfo=0&origin=${typeof window !== "undefined" ? window.location.origin : ""}`
    : null;

  // ポスター画像URL（予告編がない場合のフォールバック）
  const backgroundPosterUrl = currentMovie?.poster_path
    ? `https://image.tmdb.org/t/p/w1280${currentMovie.poster_path}`
    : null;

  // モーダル用の動画URL（UI要素を非表示、常にミュートで読み込み→postMessageでミュート解除して再生位置を維持）
  const modalVideoUrl = currentMovie?.video_key
    ? `https://www.youtube.com/embed/${currentMovie.video_key}?autoplay=1&loop=1&playlist=${currentMovie.video_key}&controls=0&modestbranding=1&rel=0&mute=1&playsinline=1&enablejsapi=1&iv_load_policy=3&cc_load_policy=0&fs=0&showinfo=0&origin=${typeof window !== "undefined" ? window.location.origin : ""}`
    : null;

  // 現在の作品と、次の数作品の動画情報を先読み取得（読み込み時間をゼロに近づける）
  useEffect(() => {
    const fetchVideos = async () => {
      if (!movies.length) return;

      // 現在の作品 + 次の3作品まで先読み
      const targets = [
        currentIndex,
        currentIndex + 1,
        currentIndex + 2,
        currentIndex + 3
      ].filter((idx) => idx < movies.length);

      // 並列で一気に取得
      await Promise.all(
        targets.map(async (idx) => {
          const movie = movies[idx];
          if (!movie || movie.video_key) return;

          const vRes = await fetch(`/api/movies/${movie.id}/videos`);
          const vData = await vRes.json().catch(() => ({}));
          const videoKey = vData?.key ?? null;
          if (!videoKey) return;

          setMovies((prev) =>
            prev.map((m, i) => (i === idx ? { ...m, video_key: videoKey } : m))
          );
        })
      );
    };

    void fetchVideos();
  }, [movies, currentIndex]);

  // 動画URLが変更されたら、すぐにiframeを更新
  useEffect(() => {
    if (backgroundVideoRef.current && backgroundVideoUrl && !isVideoFullscreen) {
      backgroundVideoRef.current.src = backgroundVideoUrl;
    }
  }, [backgroundVideoUrl, isVideoFullscreen]);

  // 全画面表示が解除されたら、背景動画を更新
  useEffect(() => {
    if (!isVideoFullscreen && backgroundVideoRef.current && backgroundVideoUrl) {
      backgroundVideoRef.current.src = backgroundVideoUrl;
    }
  }, [isVideoFullscreen, backgroundVideoUrl]);

  // ミュート状態をpostMessageで反映（iframeを再読み込みせず再生位置を維持）
  useEffect(() => {
    const iframe = backgroundVideoRef.current;
    if (!iframe?.contentWindow || !currentMovie?.video_key || isVideoFullscreen) return;
    try {
      iframe.contentWindow.postMessage(
        JSON.stringify({
          event: "command",
          func: isBackgroundMuted ? "mute" : "unMute"
        }),
        "*"
      );
    } catch {
      // postMessage失敗時は無視
    }
  }, [isBackgroundMuted, currentMovie?.video_key, isVideoFullscreen]);

  // 全画面のミュート状態をpostMessageで反映（iframeを再読み込みせず再生位置を維持）
  useEffect(() => {
    const iframe = fullscreenVideoRef.current;
    if (!iframe?.contentWindow || !currentMovie?.video_key || !isVideoFullscreen) return;
    try {
      iframe.contentWindow.postMessage(
        JSON.stringify({
          event: "command",
          func: isFullscreenMuted ? "mute" : "unMute"
        }),
        "*"
      );
    } catch {
      // postMessage失敗時は無視
    }
  }, [isFullscreenMuted, currentMovie?.video_key, isVideoFullscreen]);

  // iframe onLoad で参照するため ref を同期
  isBackgroundMutedRef.current = isBackgroundMuted;
  isFullscreenMutedRef.current = isFullscreenMuted;

  // 作品が変更されたらモーダルを閉じる（全画面は継続するので setIsVideoFullscreen は呼ばない）
  useEffect(() => {
    setIsInfoModalOpen(false);
    setIsModalMuted(true);
  }, [currentMovie?.id]);

  // モーダル内の動画URLが変更されたら、iframeを更新
  useEffect(() => {
    if (modalVideoRef.current && modalVideoUrl && isInfoModalOpen) {
      modalVideoRef.current.src = modalVideoUrl;
    }
  }, [modalVideoUrl, isInfoModalOpen]);

  // モーダルが開いたときにミュート状態をリセット
  useEffect(() => {
    if (isInfoModalOpen) {
      setIsModalMuted(true);
    }
  }, [isInfoModalOpen]);

  // モーダル内のミュート状態をpostMessageで反映（iframeを再読み込みせず再生位置を維持）
  useEffect(() => {
    const iframe = modalVideoRef.current;
    if (!iframe?.contentWindow || !currentMovie?.video_key || !isInfoModalOpen) return;
    try {
      iframe.contentWindow.postMessage(
        JSON.stringify({
          event: "command",
          func: isModalMuted ? "mute" : "unMute"
        }),
        "*"
      );
    } catch {
      // postMessage失敗時は無視
    }
  }, [isModalMuted, currentMovie?.video_key, isInfoModalOpen]);

  // watch providersを取得（Netflixのみ選択時は米国、未選択時はJP+USをマージして表示）
  useEffect(() => {
    const fetchWatchProviders = async () => {
      if (!currentMovie) {
        setWatchProviders(null);
        return;
      }

      const isNetflixOnly =
        selectedProviders.length === 1 && selectedProviders[0] === "8";
      const noProvidersSelected = selectedProviders.length === 0;

      if (noProvidersSelected) {
        // 配信サービス未選択時はJPとUSの両方を取得してマージ（どちらかにデータがあれば表示）
        const [resJp, resUs] = await Promise.all([
          fetch(`/api/movies/${currentMovie.id}/watch-providers?region=JP`),
          fetch(`/api/movies/${currentMovie.id}/watch-providers?region=US`)
        ]);
        const dataJp = await resJp.json().catch(() => ({}));
        const dataUs = await resUs.json().catch(() => ({}));
        const providersJp = (dataJp?.providers ?? []) as WatchProvider[];
        const providersUs = (dataUs?.providers ?? []) as WatchProvider[];
        const seen = new Set<number>();
        const merged: WatchProvider[] = [];
        for (const p of [...providersJp, ...providersUs]) {
          if (!seen.has(p.provider_id)) {
            seen.add(p.provider_id);
            merged.push(p);
          }
        }
        setWatchProviders(merged.length > 0 ? merged : null);
      } else {
        const region = isNetflixOnly ? "US" : "JP";
        const res = await fetch(
          `/api/movies/${currentMovie.id}/watch-providers?region=${region}`
        );
        const data = await res.json().catch(() => ({}));
        setWatchProviders(data?.providers ?? null);
      }
    };

    void fetchWatchProviders();
  }, [currentMovie?.id, selectedProviders]);

  // 現在の作品のあらすじをAIで1行要約（キャッシュにあればスキップ）
  const requestedSynopsisIdsRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!currentMovie?.id) return;
    if (synopsisCache[currentMovie.id] != null) return;
    if (requestedSynopsisIdsRef.current.has(currentMovie.id)) return;

    requestedSynopsisIdsRef.current.add(currentMovie.id);
    const controller = new AbortController();
    const movieId = currentMovie.id;
    const overview = currentMovie.overview;
    const title = currentMovie.title;

    const fetchSynopsis = async () => {
      try {
        const res = await fetch("/api/synopsis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ overview, title }),
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        const synopsis = typeof data.synopsis === "string" ? data.synopsis : null;
        if (synopsis) {
          setSynopsisCache((prev) => ({ ...prev, [movieId]: synopsis }));
        }
      } catch (err) {
        // クリーンアップでabortされた場合は無視（意図的なキャンセル）
        if (err instanceof Error && err.name === "AbortError") return;
        throw err;
      }
    };
    void fetchSynopsis();
    return () => controller.abort();
  }, [currentMovie?.id, currentMovie?.overview, currentMovie?.title, synopsisCache]);

  const handleSwipe = async (direction: "left" | "right") => {
    if (!currentMovie || !user) return;
    setMobileSwipeTrigger(null);

    const status: LikeStatus = direction === "right" ? "like" : "bad";

    // handleSwipeが実行されていることをマーク（useEffectの再実行時にcurrentIndexをリセットしないため）
    isSwipingRef.current = true;

    // まず、likedIds/badIdsを更新
    if (status === "like") {
      setLikedIds((prev) => [...prev, currentMovie.id]);
    } else {
      setBadIds((prev) => [...prev, currentMovie.id]);
    }

    // moviesから現在の作品を除外（フィルター緩和が適用されている場合でも、LIKE/BADした作品は除外）
    setMovies((prev) => {
      const filtered = prev.filter((m) => m.id !== currentMovie.id);
      return filtered;
    });

    // 次の作品に進む（moviesから除外したので、実質的に次の作品になる）
    setCurrentIndex((prev) => {
      // 現在のインデックスが範囲外になる場合、0にリセット
      return prev >= movies.length - 1 ? 0 : prev;
    });

    const { error } = await supabase.from("likes").upsert(
      {
        user_id: user.id,
        tmdb_id: currentMovie.id,
        media_type: "movie",
        status
      },
      {
        onConflict: "user_id,tmdb_id,media_type"
      }
    );

    if (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    }
  };

  const toggleProvider = (id: string) => {
    setSelectedProviders((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const toggleGenre = (id: string) => {
    setSelectedGenres((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-gray-400">認証状態を確認中...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center space-y-4 bg-background px-4 text-center">
        <p className="text-sm text-gray-300">
          ディスカバリー機能を利用するにはログインが必要です。
        </p>
        <Link
          href="/"
          className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-black"
        >
          トップに戻る
        </Link>
      </main>
    );
  }


  // 全画面動画URL（mute=0で読み込み、ミュート切替はpostMessageで再生位置を維持）
  const fullscreenVideoUrl = currentMovie?.video_key
    ? `https://www.youtube.com/embed/${currentMovie.video_key}?autoplay=1&loop=1&playlist=${currentMovie.video_key}&controls=0&modestbranding=1&rel=0&mute=0&playsinline=1&enablejsapi=1&iv_load_policy=3&cc_load_policy=0&fs=0&showinfo=0&origin=${typeof window !== "undefined" ? window.location.origin : ""}`
    : null;

  // 表示用あらすじ（AI要約をキャッシュから、なければ1文フォールバック）
  const displaySynopsis = currentMovie
    ? (synopsisCache[currentMovie.id] ?? getOneLineSynopsis(currentMovie.overview))
    : "";

  // 各配信サービスの作品ページ・検索ページへ直接飛ぶURLを生成（TMDB集約ページは使わない）
  const getProviderUrl = (provider: WatchProvider): string => {
    const title = currentMovie?.title ? encodeURIComponent(currentMovie.title) : "";
    // サービスIDごとに該当サービスの検索URL（作品名で検索→ユーザーが該当作品を選んで再生）
    const providerUrls: Record<number, string> = {
      8: `https://www.netflix.com/search?q=${title}`,
      9: `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${title}`,
      119: `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${title}`,
      337: `https://www.disneyplus.com/ja-jp/search?searchTerm=${title}`,
      84: `https://video.unext.jp/search?keyword=${title}`
    };
    const url = providerUrls[provider.provider_id];
    if (url) return url;
    // 未対応のサービスは JustWatch 日本で作品名検索
    return title
      ? `https://www.justwatch.com/jp/検索?q=${title}`
      : `https://www.themoviedb.org/movie/${currentMovie?.id}/watch`;
  };

  return (
    <>
      {!isVideoFullscreen && <Header />}
      <main className="relative flex min-h-screen flex-col bg-background">
        {/* 情報モーダル */}
        {isInfoModalOpen && currentMovie && (
          <div
            className="fixed inset-0 z-[100] bg-black/70 flex items-start justify-center pt-4 overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsInfoModalOpen(false);
              }
            }}
          >
            <div className="bg-black rounded-t-lg max-w-5xl w-full min-h-[calc(100vh-1rem)] flex flex-col shadow-2xl">
              {/* 閉じるボタン */}
              <button
                type="button"
                onClick={() => setIsInfoModalOpen(false)}
                className="absolute top-4 right-4 z-[101] rounded-full bg-black/60 p-3 text-white hover:bg-black/80 transition-colors"
                aria-label="閉じる"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              {/* 予告編エリア */}
              <div className="relative w-full aspect-video bg-black rounded-t-lg overflow-hidden flex-shrink-0">
                {modalVideoUrl ? (
                  <>
                    <iframe
                      ref={modalVideoRef}
                      src={modalVideoUrl}
                      className="w-full h-full"
                      allow="autoplay; encrypted-media; accelerometer; gyroscope; picture-in-picture"
                      allowFullScreen
                      style={{ pointerEvents: "none" }}
                    />
                    {/* YouTubeのUI要素（タイトル・後で見る・ロゴ）を隠すオーバーレイ */}
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: "linear-gradient(to bottom, transparent 0%, transparent 70%, rgba(0,0,0,0.95) 100%)"
                      }}
                    />
                    {/* 右下: ミュート解除ボタン（モーダル内・予告編があるときのみ） */}
                    <div className="absolute bottom-4 right-4 z-10 pointer-events-auto">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsModalMuted(!isModalMuted);
                        }}
                        className="rounded-full border-2 border-white bg-black/60 p-3 text-white hover:bg-black/80 transition-colors"
                        aria-label={isModalMuted ? "音声をON" : "音声をOFF"}
                      >
                        {isModalMuted ? (
                          <svg
                            className="h-6 w-6"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            viewBox="0 0 24 24"
                          >
                            <path d="M11 5L6 9H2v6h4l5 4V5z" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg
                            className="h-6 w-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </>
                ) : backgroundPosterUrl ? (
                  <img
                    src={backgroundPosterUrl}
                    alt={currentMovie.title}
                    className="w-full h-full object-cover"
                  />
                ) : null}
              </div>

              {/* 情報エリア */}
              <div className="px-6 py-6 md:px-8 md:py-8 flex-1 flex flex-col">
                <div className="flex flex-col md:flex-row gap-6 flex-1">
                  {/* 左側: 題名（右に評価）とあらすじ */}
                  <div className="flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
                      <h2 className="text-2xl md:text-3xl font-bold">
                        {currentMovie.title}
                      </h2>
                      <div className="flex items-center gap-1.5 text-gray-200 shrink-0">
                        <span className="text-2xl font-bold">
                          {currentMovie.vote_average.toFixed(1)}
                        </span>
                        <span className="text-yellow-400 text-lg">⭐</span>
                        <span className="text-sm text-gray-500">/ 10</span>
                      </div>
                    </div>
                    <p className="text-sm md:text-base leading-relaxed text-gray-300 mb-4 whitespace-pre-wrap">
                      {currentMovie.overview || "あらすじ情報がありません。"}
                    </p>
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      <span>
                        {currentMovie.release_date
                          ? currentMovie.release_date.slice(0, 4)
                          : "年不明"}
                      </span>
                    </div>
                  </div>

                  {/* 右側: 配信サービス（背景なし） */}
                  <div className="md:w-48 flex flex-col gap-4">
                    <div>
                      <p className="text-sm text-label mb-2">配信サービス</p>
                      {watchProviders && watchProviders.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {watchProviders.slice(0, 5).map((provider) => (
                            <button
                              key={provider.provider_id}
                              type="button"
                              onClick={() => {
                                const url = getProviderUrl(provider);
                                window.open(url, "_blank", "noopener,noreferrer");
                              }}
                              className="rounded p-1.5 hover:opacity-80 transition-opacity"
                              aria-label={`${provider.provider_name}で視聴`}
                            >
                              {provider.logo_path && (
                                <img
                                  src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                                  alt={provider.provider_name}
                                  className="h-8 w-auto"
                                />
                              )}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">なし</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* 全画面表示（動画あり→iframe、なし→ポスター or 黒。LIKE/BADで次へ行っても全画面を維持） */}
        {isVideoFullscreen && currentMovie && (
          <div className="fixed inset-0 z-[100] bg-black">
            {fullscreenVideoUrl ? (
              <>
                <iframe
                  ref={fullscreenVideoRef}
                  key={currentMovie.id}
                  src={fullscreenVideoUrl}
                  className="h-full w-full"
                  allow="autoplay; encrypted-media; accelerometer; gyroscope; picture-in-picture"
                  allowFullScreen
                  onLoad={() => {
                    const iframe = fullscreenVideoRef.current;
                    if (!iframe?.contentWindow || !currentMovie?.video_key) return;
                    const muted = isFullscreenMutedRef.current;
                    try {
                      iframe.contentWindow.postMessage(
                        JSON.stringify({
                          event: "command",
                          func: muted ? "mute" : "unMute"
                        }),
                        "*"
                      );
                    } catch {
                      // ignore
                    }
                  }}
                />
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: [
                      "linear-gradient(to bottom, transparent 0%, transparent 60%, rgba(0,0,0,0.4) 80%, rgba(0,0,0,0.95) 100%)",
                      "linear-gradient(to left, transparent 0%, transparent 85%, rgba(0,0,0,0.5) 95%, rgba(0,0,0,0.95) 100%)"
                    ].join(", ")
                  }}
                  aria-hidden
                />
              </>
            ) : backgroundPosterUrl ? (
              <img
                src={backgroundPosterUrl}
                alt={currentMovie.title || ""}
                className="h-full w-full object-cover"
              />
            ) : null}
            {/* 画面クリックで全画面解除 */}
            <div
              className="absolute inset-0 z-10 cursor-pointer"
              onClick={() => setIsVideoFullscreen(false)}
              aria-label="クリックで閉じる"
            />
            {/* 閉じるボタン */}
            <button
              type="button"
              onClick={() => setIsVideoFullscreen(false)}
              className="absolute top-4 right-4 z-[101] rounded-full bg-black/60 p-3 text-white hover:bg-black/80 transition-colors pointer-events-auto"
              aria-label="閉じる"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            {/* 右下: ミュート切替ボタン（動画がある場合のみ） */}
            {fullscreenVideoUrl && (
              <div className="absolute bottom-10 right-10 z-[101] pointer-events-auto">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFullscreenMuted(!isFullscreenMuted);
                  }}
                  className="rounded-full border-2 border-white bg-black/60 p-3 text-white hover:bg-black/80 transition-colors"
                  aria-label={isFullscreenMuted ? "音声をON" : "音声をOFF"}
                >
                  {isFullscreenMuted ? (
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <path d="M11 5L6 9H2v6h4l5 4V5z" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            )}
            {/* 全画面時も BAD / i / LIKE ボタンを表示（インフォが中央軸に来るよう右にオフセット） */}
            <div className="absolute bottom-10 left-[calc(50%-108px)] z-[101] pointer-events-auto">
              <div className="flex items-center gap-5">
                <button
                  type="button"
                  onClick={() => handleSwipe("left")}
                  className="flex items-center justify-center h-16 w-16 rounded-full border-2 border-purple-500 bg-black/60 text-purple-500 hover:bg-purple-500/20 transition-colors"
                  aria-label="BAD"
                >
                  <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setIsInfoModalOpen(true)}
                  className="flex items-center justify-center h-12 w-12 rounded-full border-2 border-gray-400 bg-black/60 text-gray-400 hover:bg-gray-400/20 transition-colors"
                  aria-label="詳細情報"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwipe("right")}
                  className="flex items-center justify-center h-16 w-16 rounded-full border-2 border-pink-500 bg-black/60 text-pink-500 hover:bg-pink-500/20 transition-colors"
                  aria-label="LIKE"
                >
                  <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* デスクトップ版: 背景に予告編動画またはポスター画像を全画面表示 */}
        {!isVideoFullscreen && (
          <div
            className="fixed inset-0 z-0 hidden md:block cursor-pointer"
            onClick={() => {
              if (backgroundVideoUrl) {
                setIsVideoFullscreen(true);
              }
            }}
          >
            {backgroundVideoUrl ? (
              <>
                <iframe
                  ref={backgroundVideoRef}
                  src={backgroundVideoUrl}
                  className="h-full w-full"
                  allow="autoplay; encrypted-media; accelerometer; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ pointerEvents: "none" }}
                  onLoad={() => {
                    const muted = isBackgroundMutedRef.current;
                    const sendMuteState = () => {
                      const iframe = backgroundVideoRef.current;
                      if (!iframe?.contentWindow || !currentMovie?.video_key) return;
                      try {
                        iframe.contentWindow.postMessage(
                          JSON.stringify({
                            event: "command",
                            func: muted ? "mute" : "unMute"
                          }),
                          "*"
                        );
                      } catch {
                        // 無視
                      }
                    };
                    sendMuteState();
                    setTimeout(sendMuteState, 400);
                  }}
                />
                {/* 動画の上に暗いオーバーレイ */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" />
                {/* YouTube右下ロゴを隠すオーバーレイ */}
                <div
                  className="absolute bottom-0 right-0 h-20 w-24 bg-black/90 pointer-events-none"
                  aria-hidden
                />
              </>
            ) : backgroundPosterUrl ? (
              <>
                <img
                  src={backgroundPosterUrl}
                  alt={currentMovie?.title || ""}
                  className="h-full w-full object-cover"
                />
                {/* ポスター画像の上に暗いオーバーレイ */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" />
              </>
            ) : null}
          </div>
        )}

        {/* UI要素を上側のレイヤーに配置 */}
        <div className={`relative z-10 flex min-h-screen flex-col overflow-visible px-4 py-4 md:px-8 ${isVideoFullscreen ? "hidden" : ""}`}>
          <section className="sticky top-0 z-40 -mx-4 mb-1.5 flex flex-wrap items-start gap-6 overflow-visible bg-transparent px-4 py-2 md:-mx-8 md:mb-4 md:px-8 md:text-sm">
            {fallbackMessage && (
              <p className="w-full rounded-lg bg-amber-900/40 px-3 py-2 text-amber-200 text-xs">
                {fallbackMessage}
              </p>
            )}
            {/* 配信サービス: ラベルのみ表示 → ホバー/タップで下にスライド表示（ジャンルと同じ仕様） */}
            <div className="group/provider relative overflow-visible provider-panel-trigger provider-dropdown-container">
              <p
                role="button"
                tabIndex={0}
                onClick={() => setIsProviderPanelOpen((o) => !o)}
                onKeyDown={(e) => e.key === "Enter" && setIsProviderPanelOpen((o) => !o)}
                className="flex cursor-pointer items-center gap-1 text-[11px] text-label transition-colors hover:text-gray-200 md:text-xs"
                aria-expanded={isProviderPanelOpen}
                aria-haspopup="true"
              >
                配信サービス
                <svg className={`h-3 w-3 transition-transform ${isProviderPanelOpen ? "translate-y-0.5 rotate-180" : ""}`} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 16l-6-6h12z" />
                </svg>
              </p>
              <div className={`absolute left-0 top-full z-50 mt-1 min-w-[400px] overflow-hidden rounded-lg border border-gray-700 bg-black/95 shadow-xl transition-[max-height,opacity] duration-300 ease-out ${isProviderPanelOpen ? "max-h-[360px] overflow-y-auto opacity-100" : "max-h-0 opacity-0"}`}>
                <div className="grid grid-cols-[repeat(4,minmax(88px,1fr))] gap-x-2 gap-y-1 p-2">
                  <GenreChip
                    label="Netflix"
                    active={selectedProviders.includes("8")}
                    onClick={() => toggleProvider("8")}
                  />
                  <GenreChip
                    label="Prime Video"
                    active={selectedProviders.includes("119")}
                    onClick={() => toggleProvider("119")}
                  />
                  <GenreChip
                    label="Disney+"
                    active={selectedProviders.includes("337")}
                    onClick={() => toggleProvider("337")}
                  />
                  <GenreChip
                    label="U-NEXT"
                    active={selectedProviders.includes("84")}
                    onClick={() => toggleProvider("84")}
                  />
                </div>
              </div>
            </div>

            {/* ジャンル: ラベルのみ表示 → ホバー/タップで下にスライド表示 */}
            <div className="group/genre relative overflow-visible genre-dropdown-container genre-panel-trigger">
              <p
                role="button"
                tabIndex={0}
                onClick={() => setIsGenrePanelOpen((o) => !o)}
                onKeyDown={(e) => e.key === "Enter" && setIsGenrePanelOpen((o) => !o)}
                className="flex cursor-pointer items-center gap-1 text-[11px] text-label transition-colors hover:text-gray-200 md:text-xs"
                aria-expanded={isGenrePanelOpen}
                aria-haspopup="true"
              >
                ジャンル
                <svg className={`h-3 w-3 transition-transform ${isGenrePanelOpen ? "translate-y-0.5 rotate-180" : ""}`} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 16l-6-6h12z" />
                </svg>
              </p>
              <div className={`absolute left-0 top-full z-50 mt-1 min-w-[400px] rounded-lg bg-black/95 shadow-xl transition-[max-height,opacity] duration-300 ease-out ${isGenrePanelOpen ? "max-h-[360px] overflow-y-auto opacity-100" : "max-h-0 overflow-hidden opacity-0"}`}>
                <div className="grid grid-cols-[repeat(4,minmax(88px,1fr))] gap-x-2 gap-y-1 p-2">
                  {genres.map((genre) => (
                    <GenreChip
                      key={genre.id}
                      label={genre.name}
                      active={selectedGenres.includes(genre.id)}
                      onClick={() => toggleGenre(genre.id)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* モバイル版: 右端にマイリスト */}
            {user && (
              <Link
                href="/my-list"
                className="underline-slide ml-auto md:hidden rounded-full px-3 py-1 text-[11px] font-medium text-pink-400/80 hover:text-pink-400"
                aria-label="マイリストを見る"
              >
                ♡マイリスト
              </Link>
            )}
          </section>

          <section className="relative flex flex-1 flex-col items-center justify-start gap-4 pt-2 md:justify-center md:pt-0">
            {/* デスクトップ: 予告編エリアをクリックで全画面表示（ボタン類はz-20で上に表示） */}
            <div
              className="hidden md:block absolute inset-0 z-0 cursor-pointer"
              onClick={() => {
                if (backgroundVideoUrl) setIsVideoFullscreen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && backgroundVideoUrl) setIsVideoFullscreen(true);
              }}
              role="button"
              tabIndex={0}
              aria-label="予告編を全画面で再生"
            />
            {error && (
              <p className="text-xs text-red-400 md:text-sm">
                {error}（環境変数 TMDB_API_KEY を確認してください）
              </p>
            )}

            {loadingMovies ? (
              <p className="text-sm text-gray-400">作品を読み込み中...</p>
            ) : currentMovie ? (
              <>
                {/* モバイル版: 単一カードのみ表示（スワイプ時のチラつき防止） */}
                <div className="md:hidden flex items-start justify-center min-h-[560px] relative">
                  <SwipeCard
                    movie={currentMovie}
                    onSwipe={handleSwipe}
                    synopsis={displaySynopsis}
                    onInfoClick={() => setIsInfoModalOpen(true)}
                    triggerSwipe={mobileSwipeTrigger}
                  />
                </div>

                {/* デスクトップ版: 左下に作品情報 / 中央下にアクション */}
                <div className="hidden md:block">
                  {/* 中央下: タイトル・あらすじ・年・評価 */}
                  <div className="fixed bottom-28 left-1/2 z-20 w-full max-w-2xl -translate-x-1/2 px-6 text-center">
                    <h2 className="text-5xl font-bold drop-shadow-lg">
                      {currentMovie.title}
                    </h2>
                    <p className="mt-3 truncate text-base text-gray-100 drop-shadow-md">
                      {displaySynopsis}
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-3 text-sm text-gray-200">
                      <span>
                        {currentMovie.release_date
                          ? currentMovie.release_date.slice(0, 4)
                          : "年不明"}
                      </span>
                      <span className="rounded-full bg-black/60 px-3 py-1">
                        ⭐ {currentMovie.vote_average.toFixed(1)}
                      </span>
                    </div>
                  </div>

                  {/* 中央下: BAD / i / LIKE（インフォが中央軸に来るよう右にオフセット） */}
                  <div className="fixed bottom-10 left-[calc(50%-108px)] z-20">
                    <div className="flex items-center gap-5">
                      {/* BADボタン（紫のXアイコン） */}
                      <button
                        type="button"
                        onClick={() => handleSwipe("left")}
                        className="hidden md:flex items-center justify-center h-16 w-16 rounded-full border-2 border-purple-500 bg-transparent text-purple-500 hover:bg-purple-500/20 transition-colors"
                        aria-label="BAD"
                      >
                        <svg
                          className="h-7 w-7"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                      {/* iボタン（グレーのiアイコン） */}
                      <button
                        type="button"
                        onClick={() => setIsInfoModalOpen(true)}
                        className="hidden md:flex items-center justify-center h-12 w-12 rounded-full border-2 border-gray-400 bg-transparent text-gray-400 hover:bg-gray-400/20 transition-colors"
                        aria-label="詳細情報"
                      >
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </button>
                      {/* LIKEボタン（ピンクのハートアイコン） */}
                      <button
                        type="button"
                        onClick={() => handleSwipe("right")}
                        className="hidden md:flex items-center justify-center h-16 w-16 rounded-full border-2 border-pink-500 bg-transparent text-pink-500 hover:bg-pink-500/20 transition-colors"
                        aria-label="LIKE"
                      >
                        <svg
                          className="h-7 w-7"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                      </button>
                      {/* ♡マイリスト（LIKEの右隣・少し下にずらす） */}
                      {user && (
                        <Link
                          href="/my-list"
                          className="underline-slide hidden md:inline-flex self-end mb-1 rounded-full px-3 py-1.5 text-xs font-medium text-pink-400/80 hover:text-pink-400 md:px-4 md:py-2 md:text-sm"
                          aria-label="マイリストを見る"
                        >
                          ♡マイリスト
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* 右側下部: ミュート解除ボタン */}
                  {backgroundVideoUrl && (
                    <div className="fixed bottom-10 right-10 z-20">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsBackgroundMuted(!isBackgroundMuted);
                        }}
                        className="rounded-full border-2 border-white bg-black/60 p-3 text-white hover:bg-black/80 transition-colors"
                        aria-label={isBackgroundMuted ? "音声をON" : "音声をOFF"}
                      >
                        {isBackgroundMuted ? (
                          <svg
                            className="h-6 w-6"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            viewBox="0 0 24 24"
                          >
                            <path d="M11 5L6 9H2v6h4l5 4V5z" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg
                            className="h-6 w-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* モバイル版の BAD / Info / LIKE は SwipeCard 内に表示 */}
              </>
            ) : (
              <div className="text-center space-y-4">
                {fallbackMessage ? (
                  <>
                    <p className="text-sm text-gray-300">
                      表示できる作品がありません。
                    </p>
                    <p className="text-xs text-amber-200 max-w-md mx-auto">
                      {fallbackMessage}
                    </p>
                    <p className="text-xs text-gray-400 max-w-md mx-auto">
                      TMDB APIから作品が取得できていません。配信サービスを変更するか、下の「再読み込み」を試してください。
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-300">
                      表示できる作品がありません。
                    </p>
                    <p className="text-xs text-gray-400 max-w-md mx-auto">
                      TMDB APIから作品が取得できていません。配信サービスを1つだけ選択するか、下の「再読み込み」を試してください。ブラウザの開発者ツール（F12）のコンソールにエラーが出ていないかも確認してください。
                    </p>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setRefreshTrigger((t) => t + 1)}
                  className="rounded-full bg-emerald-500 px-6 py-2 text-sm font-semibold text-black hover:bg-emerald-400 transition-colors"
                >
                  再読み込み
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

function FilterChip({
  label,
  active,
  onClick
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap flex-shrink-0 rounded-full px-3 py-1 text-xs border ${active
        ? "border-emerald-400 text-emerald-300"
        : "border-transparent text-gray-200 hover:border-gray-500"
        } bg-transparent`}
    >
      {label}
    </button>
  );
}

function GenreChip({
  label,
  active,
  onClick
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full min-w-0 overflow-visible whitespace-nowrap px-1 py-1 text-left text-xs text-gray-200 transition-colors hover:text-white hover:underline hover:underline-offset-2 ${active ? "border-b-2 border-white font-medium text-white" : "border-b-2 border-transparent"}`}
    >
      {label}
    </button>
  );
}


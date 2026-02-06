"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { Header } from "@/components/Header";
import type { TmdbMovie, WatchProvider } from "@/lib/tmdb";
import { getOneLineSynopsis } from "@/lib/synopsis";

type LikeRow = {
  tmdb_id: number;
};

export default function MyListPage() {
  const { user, loading } = useAuth();
  const [movies, setMovies] = useState<TmdbMovie[]>([]);
  const [likedIdsCount, setLikedIdsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<TmdbMovie | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [watchProviders, setWatchProviders] = useState<WatchProvider[] | null>(null);
  const [isModalMuted, setIsModalMuted] = useState(true);
  const [synopsisCache, setSynopsisCache] = useState<Record<number, string>>({});
  const modalVideoRef = useRef<HTMLIFrameElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<TmdbMovie | null>(null);

  useEffect(() => {
    const fetchMyList = async () => {
      if (!user) return;
      setIsLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from("likes")
          .select("tmdb_id")
          .eq("user_id", user.id)
          .eq("status", "like")
          .order("created_at", { ascending: false });

        if (error) throw error;

        const ids = (data ?? []).map((row: LikeRow) => row.tmdb_id);
        setLikedIdsCount(ids.length);

        const results: TmdbMovie[] = [];
        for (const id of ids) {
          const res = await fetch(`/api/movies/${id}`);
          if (!res.ok) continue;
          const text = await res.text();
          if (!text || text.trim() === "") continue;
          try {
            const movie = JSON.parse(text) as TmdbMovie;
            // 動画情報を取得
            const vRes = await fetch(`/api/movies/${id}/videos`).catch(() => null);
            if (vRes?.ok) {
              const vData = await vRes.json().catch(() => ({}));
              if (vData?.key) {
                movie.video_key = vData.key;
              }
            }
            results.push(movie);
          } catch {
            // パースエラーはスキップ
          }
        }
        setMovies(results);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "マイリストの取得中にエラーが発生しました。"
        );
      } finally {
        setIsLoading(false);
      }
    };

    void fetchMyList();
  }, [user]);

  // 選択された映画のwatch providersを取得
  useEffect(() => {
    const fetchWatchProviders = async () => {
      if (!selectedMovie) {
        setWatchProviders(null);
        return;
      }

      const res = await fetch(`/api/movies/${selectedMovie.id}/watch-providers`);
      const data = await res.json().catch(() => ({}));
      setWatchProviders(data?.providers ?? null);
    };

    void fetchWatchProviders();
  }, [selectedMovie?.id]);

  // 選択された映画のあらすじをAIで1行要約（キャッシュにあればスキップ）
  useEffect(() => {
    if (!selectedMovie?.id || synopsisCache[selectedMovie.id] != null) return;

    const controller = new AbortController();
    const fetchSynopsis = async () => {
      const res = await fetch("/api/synopsis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overview: selectedMovie.overview,
          title: selectedMovie.title,
        }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      const synopsis = typeof data.synopsis === "string" ? data.synopsis : null;
      if (synopsis) {
        setSynopsisCache((prev) => ({ ...prev, [selectedMovie.id]: synopsis }));
      }
    };
    void fetchSynopsis();
    return () => controller.abort();
  }, [selectedMovie?.id, selectedMovie?.overview, selectedMovie?.title, synopsisCache]);

  // モーダル用の動画URL
  const modalVideoUrl = selectedMovie?.video_key
    ? `https://www.youtube.com/embed/${selectedMovie.video_key}?autoplay=1&loop=1&playlist=${selectedMovie.video_key}&controls=0&modestbranding=1&rel=0&mute=1&playsinline=1&enablejsapi=1&iv_load_policy=3&cc_load_policy=0&fs=0&showinfo=0&origin=${typeof window !== "undefined" ? window.location.origin : ""}`
    : null;

  // モーダルが開いたときにミュート状態をリセット
  useEffect(() => {
    if (isModalOpen) {
      setIsModalMuted(true);
    }
  }, [isModalOpen]);

  // モーダル内の動画URLが変更されたら、iframeを更新
  useEffect(() => {
    if (modalVideoRef.current && modalVideoUrl && isModalOpen) {
      modalVideoRef.current.src = modalVideoUrl;
    }
  }, [modalVideoUrl, isModalOpen]);

  // モーダル内のミュート状態をpostMessageで反映
  useEffect(() => {
    const iframe = modalVideoRef.current;
    if (!iframe?.contentWindow || !selectedMovie?.video_key || !isModalOpen) return;
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
  }, [isModalMuted, selectedMovie?.video_key, isModalOpen]);

  // ポスター画像URL
  const modalPosterUrl = selectedMovie?.poster_path
    ? `https://image.tmdb.org/t/p/w1280${selectedMovie.poster_path}`
    : null;

  // 各配信サービスの作品検索ページへ直接飛ぶURLを生成（TMDB集約ページは使わない）
  const getProviderUrl = (provider: WatchProvider, title?: string) => {
    const q = title ? encodeURIComponent(title) : "";
    const providerUrls: Record<number, string> = {
      8: `https://www.netflix.com/search?q=${q}`,
      9: `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${q}`,
      119: `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${q}`,
      337: `https://www.disneyplus.com/ja-jp/search?searchTerm=${q}`,
      84: `https://video.unext.jp/search?keyword=${q}`
    };
    const url = providerUrls[provider.provider_id];
    if (url) return url;
    return q ? `https://www.justwatch.com/jp/検索?q=${q}` : `https://www.themoviedb.org/movie/${selectedMovie?.id}/watch`;
  };

  const getProviderUrlForMovie = (provider: WatchProvider, movie: TmdbMovie) =>
    getProviderUrl(provider, movie.title);

  // マイリストから削除（実処理。確認ダイアログは別 state で制御）
  const handleDelete = async (movieId: number) => {
    if (!user) return;

    const { error } = await supabase
      .from("likes")
      .delete()
      .eq("user_id", user.id)
      .eq("tmdb_id", movieId)
      .eq("status", "like");

    if (error) {
      // eslint-disable-next-line no-console
      console.error("削除エラー:", error);
      alert("削除に失敗しました。");
      return;
    }

    // リストから削除
    setMovies((prev) => prev.filter((m) => m.id !== movieId));
    setLikedIdsCount((prev) => prev - 1);
    
    // モーダルが開いていたら閉じる
    if (selectedMovie?.id === movieId) {
      setIsModalOpen(false);
      setSelectedMovie(null);
    }
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
          マイリストを表示するにはログインが必要です。
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

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background px-4 py-4 md:px-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold md:text-2xl">マイリスト</h1>
          <Link
            href="/discover"
            className="underline-slide underline-always shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-[#E6E7EB] hover:text-[#E6E7EB] md:hidden"
            aria-label="ホームへ"
          >
            ホームへ
          </Link>
        </div>

        {error && (
        <p className="mb-2 text-xs text-red-400 md:text-sm">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400">マイリストを読み込み中...</p>
      ) : movies.length === 0 ? (
        <p className="text-sm text-gray-300">
          {likedIdsCount > 0
            ? "作品情報の取得に失敗しました。しばらくしてからページを再読み込みしてください。"
            : "まだ LIKE した作品がありません。ディスカバリー画面から LIKE してみましょう。"}
        </p>
      ) : (
        <section className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {movies.map((movie) => (
            <MovieItem
              key={movie.id}
              movie={movie}
              onSelect={() => {
                setSelectedMovie(movie);
                setIsModalOpen(true);
              }}
              onDelete={() => setDeleteTarget(movie)}
              getProviderUrl={getProviderUrlForMovie}
            />
          ))}
        </section>
      )}
      </main>

      {/* マイリスト削除用カスタムダイアログ */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-[#14161A] p-5 shadow-xl">
            <h2 className="mb-2 text-base font-semibold text-[#E6E7EB]">
              マイリストから削除しますか？
            </h2>
            <p className="mb-1 text-sm font-medium text-[#E6E7EB]">
              {deleteTarget.title}
            </p>
            <p className="mb-4 text-xs text-gray-400">
              この作品はあなたのマイリストから削除されます。あとでまた LIKE し直すことはできます。
            </p>
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-full border border-gray-600 px-3 py-1.5 text-gray-200 hover:bg-gray-700/60"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleDelete(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="rounded-full bg-red-500 px-3 py-1.5 font-semibold text-black hover:bg-red-400"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 予告編モーダル */}
      {isModalOpen && selectedMovie && (
        <div 
          className="fixed inset-0 z-[100] bg-black/70 flex items-start justify-center pt-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsModalOpen(false);
            }
          }}
        >
          <div className="bg-black rounded-t-lg max-w-5xl w-full min-h-[calc(100vh-1rem)] flex flex-col shadow-2xl">
            {/* 閉じるボタン */}
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
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
                  {/* 視聴可能サービスのアイコン（右上・アイコンのみ・大きめ） */}
                  {watchProviders && watchProviders.length > 0 && (
                    <div className="hidden md:flex absolute top-4 right-4 gap-2 z-10 pointer-events-auto">
                      {watchProviders.slice(0, 3).map((provider) => (
                        <button
                          key={provider.provider_id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const url = getProviderUrl(provider, selectedMovie?.title);
                            window.open(url, "_blank", "noopener,noreferrer");
                          }}
                          className="rounded p-1 hover:opacity-80 transition-opacity"
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
                  )}
                  {/* 右下: ミュート解除ボタン（モーダル内） */}
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
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M6.343 6.343l4.243 4.243M6.343 17.657l4.243-4.243m5.656 0l4.243 4.243m0-9.9l-4.243 4.243"
                          />
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
              ) : modalPosterUrl ? (
                <img
                  src={modalPosterUrl}
                  alt={selectedMovie.title}
                  className="w-full h-full object-cover"
                />
              ) : null}
            </div>

            {/* 情報エリア */}
            <div className="px-6 py-6 md:px-8 md:py-8 flex-1 flex flex-col">
              <div className="flex flex-col md:flex-row gap-6 flex-1">
                {/* 左側: 題名・あらすじ・年・配信サービス */}
                <div className="flex-1">
                  {/* 1行目: 題名（デスクトップは右に評価） */}
                  <div className="flex flex-wrap items-baseline justify-between gap-3 mb-2">
                    <h2 className="text-2xl md:text-3xl font-bold">
                      {selectedMovie.title}
                    </h2>
                    <div className="hidden md:flex items-center gap-1.5 text-gray-200 shrink-0">
                      <span className="text-2xl font-bold">
                        {selectedMovie.vote_average.toFixed(1)}
                      </span>
                      <span className="text-yellow-400 text-lg">⭐</span>
                      <span className="text-sm text-gray-500">/ 10</span>
                    </div>
                  </div>
                  {/* スマホのみ: 2行目＝左に評価＋配信サービス、右端に削除ボタン */}
                  <div className="flex items-center justify-between gap-3 mb-4 md:hidden">
                    <div className="flex items-center gap-2 text-gray-200">
                      <span className="text-xl font-bold">
                        {selectedMovie.vote_average.toFixed(1)}
                      </span>
                      <span className="text-yellow-400 text-base">⭐</span>
                      {watchProviders && watchProviders.length > 0 && (
                        <div className="ml-1 flex gap-1">
                          {watchProviders.slice(0, 3).map((provider) => (
                            <button
                              key={provider.provider_id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const url = getProviderUrl(provider, selectedMovie?.title);
                                window.open(url, "_blank", "noopener,noreferrer");
                              }}
                              className="rounded p-0.5 hover:opacity-80 transition-opacity"
                              aria-label={`${provider.provider_name}で視聴`}
                            >
                              {provider.logo_path && (
                                <img
                                  src={`https://image.tmdb.org/t/p/w45${provider.logo_path}`}
                                  alt={provider.provider_name}
                                  className="h-5 w-auto"
                                />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(selectedMovie)}
                      className="shrink-0 inline-flex items-center justify-center text-red-500 hover:text-red-400"
                      aria-label="マイリストから削除"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                  <p className="text-sm md:text-base leading-relaxed text-gray-300 mb-4 whitespace-pre-wrap">
                    {selectedMovie.overview || "あらすじ情報がありません。"}
                  </p>
                  <div className="flex items-center gap-3 text-sm text-gray-400 mb-4">
                    <span>
                      {selectedMovie.release_date
                        ? selectedMovie.release_date.slice(0, 4)
                        : "年不明"}
                    </span>
                  </div>
                  {/* あらすじの下: 配信サービスアイコン（デスクトップのみ） */}
                  <div className="hidden md:block">
                    <p className="text-sm text-label mb-2">配信サービス</p>
                    {watchProviders && watchProviders.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {watchProviders.map((provider) => (
                          <button
                            key={provider.provider_id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const url = getProviderUrl(provider, selectedMovie?.title);
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

                {/* 右側: 評価（デスクトップのみ・モバイルはタイトル横に表示済み） */}
                <div className="hidden md:block md:w-48">
                  <div className="bg-gray-900 rounded-lg p-4">
                    <p className="text-sm text-label mb-2">評価</p>
                    <div className="flex items-center gap-2">
                      <span className="text-3xl font-bold">
                        {selectedMovie.vote_average.toFixed(1)}
                      </span>
                      <span className="text-yellow-400 text-xl">⭐</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      / 10.0
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// 映画アイテムコンポーネント
function MovieItem({
  movie,
  onSelect,
  onDelete,
  getProviderUrl
}: {
  movie: TmdbMovie;
  onSelect: () => void;
  onDelete: () => void;
  getProviderUrl: (provider: WatchProvider, movie: TmdbMovie) => string;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [providers, setProviders] = useState<WatchProvider[] | null>(null);

  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w300${movie.poster_path}`
    : null;

  const handleMouseEnter = async () => {
    setIsHovered(true);
    const res = await fetch(`/api/movies/${movie.id}/watch-providers`);
    const data = await res.json().catch(() => ({}));
    setProviders(data?.providers ?? null);
  };

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-xl bg-[#1a1a1a] cursor-pointer"
      onClick={onSelect}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
    >
      {posterUrl ? (
        <img
          src={posterUrl}
          alt={movie.title}
          className="aspect-[2/3] w-full object-cover transition-transform group-hover:scale-105"
        />
      ) : (
        <div className="flex aspect-[2/3] items-center justify-center bg-gray-900">
          <span className="text-[10px] text-gray-400">
            画像なし
          </span>
        </div>
      )}
      {/* ホバー時のオーバーレイ */}
      {isHovered && (
        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 p-2">
          {/* 配信サービスアイコン */}
          {providers && providers.length > 0 ? (
            <div className="flex gap-2 flex-wrap justify-center">
              {providers.slice(0, 3).map((provider) => (
                <button
                  key={provider.provider_id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const url = getProviderUrl(provider, movie);
                    window.open(url, "_blank", "noopener,noreferrer");
                  }}
                  className="rounded p-1 hover:opacity-80 transition-opacity bg-black/40"
                  aria-label={`${provider.provider_name}で視聴`}
                >
                  {provider.logo_path && (
                    <img
                      src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                      alt={provider.provider_name}
                      className="h-12 w-auto sm:h-10 md:h-9 lg:h-8"
                    />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-300">配信情報なし</p>
          )}
        </div>
      )}
      {/* ゴミ箱アイコン（右上） */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-2 right-2 z-10 rounded-full bg-black/70 p-2 text-white hover:bg-red-600/80 transition-colors opacity-0 group-hover:opacity-100"
        aria-label="マイリストから削除"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
      <div className="p-2">
        <p className="line-clamp-2 text-[11px] text-gray-100">
          {movie.title}
        </p>
        <p className="mt-0.5 text-[10px] text-gray-400">
          {movie.release_date
            ? movie.release_date.slice(0, 4)
            : "年不明"}
        </p>
      </div>
    </div>
  );
}


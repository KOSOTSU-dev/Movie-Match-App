"use client";

import { motion, useAnimation } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { TmdbMovie } from "@/lib/tmdb";
import { getOneLineSynopsis } from "@/lib/synopsis";

type SwipeDirection = "left" | "right" | null;

type Props = {
  movie: TmdbMovie;
  onSwipe: (direction: "left" | "right") => void;
  /** AI要約あらすじ（指定時はこれを使用） */
  synopsis?: string;
  /** タップで詳細モーダルを開く（モバイル用） */
  onInfoClick?: () => void;
  /** ボタン押下でスワイプアニメーションを再生（LIKE→right, BAD→left） */
  triggerSwipe?: "left" | "right" | null;
};

export function SwipeCard({ movie, onSwipe, synopsis, onInfoClick, triggerSwipe }: Props) {
  const controls = useAnimation();
  const [isDragging, setIsDragging] = useState(false);
  const didSwipeRef = useRef(false);
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;
  const ignoreTapRef = useRef(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const programmaticSwipe = (direction: "left" | "right") => {
    didSwipeRef.current = true;
    const toX = direction === "right" ? 500 : -500;
    const rotate = direction === "right" ? 20 : -20;
    void controls.start({
      x: toX,
      rotate,
      opacity: 0,
      transition: { duration: 0.3 }
    });
    window.setTimeout(() => {
      onSwipeRef.current(direction);
    }, 200);
  };

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: { offset: { x: number }; velocity: { x: number } }
  ) => {
    const threshold = 120;
    const velocityThreshold = 500;
    let direction: SwipeDirection = null;

    if (info.offset.x > threshold || info.velocity.x > velocityThreshold) {
      direction = "right";
    } else if (
      info.offset.x < -threshold ||
      info.velocity.x < -velocityThreshold
    ) {
      direction = "left";
    }

    if (!direction) {
      void controls.start({ x: 0, rotate: 0, transition: { type: "spring" } });
      setIsDragging(false);
      return;
    }

    didSwipeRef.current = true;
    const toX = direction === "right" ? 500 : -500;

    void controls.start({
      x: toX,
      rotate: direction === "right" ? 20 : -20,
      opacity: 0,
      transition: { duration: 0.3 }
    });

    setIsDragging(false);

    window.setTimeout(() => {
      onSwipe(direction);
    }, 200);
  };

  const handleTap = () => {
    if (ignoreTapRef.current) {
      ignoreTapRef.current = false;
      return;
    }
    if (didSwipeRef.current) {
      didSwipeRef.current = false;
      return;
    }
    onInfoClick?.();
  };

  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : null;

  // 動画は常にミュート状態で読み込み、音声ON/OFFは postMessage で制御する
  const videoUrl = movie.video_key
    ? `https://www.youtube.com/embed/${movie.video_key}?autoplay=1&loop=1&playlist=${movie.video_key}&controls=0&modestbranding=1&rel=0&mute=1&playsinline=1&enablejsapi=1&origin=${typeof window !== "undefined" ? window.location.origin : ""}`
    : null;

  useEffect(() => {
    // 動画が変更されたら、ミュート状態と読み込み状態をリセットして再読み込み
    setIsMuted(true);
    setIsVideoLoaded(false);
    if (iframeRef.current && videoUrl) {
      iframeRef.current.src = videoUrl;
    }
  }, [movie.id, videoUrl]);

  // ボタン押下でスワイプアニメーションを再生（モバイル用）
  useEffect(() => {
    if (triggerSwipe !== "left" && triggerSwipe !== "right") return;
    didSwipeRef.current = true;
    const direction = triggerSwipe;
    const toX = direction === "right" ? 500 : -500;
    const rotate = direction === "right" ? 20 : -20;
    void controls.start({
      x: toX,
      rotate,
      opacity: 0,
      transition: { duration: 0.3 }
    });
    const t = window.setTimeout(() => {
      onSwipeRef.current(direction);
    }, 200);
    return () => window.clearTimeout(t);
  }, [triggerSwipe, controls]);

  // 作品が変わったらアニメーション状態をリセット
  useEffect(() => {
    void controls.set({ x: 0, rotate: 0, opacity: 1 });
  }, [movie.id, controls]);

  return (
    <motion.div
      className="relative h-[80vh] max-h-[720px] w-full max-w-[430px] cursor-grab select-none touch-pan-y rounded-3xl bg-card shadow-xl overflow-hidden md:h-[520px] md:w-[340px]"
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.6}
      onDragStart={() => {
        setIsDragging(true);
        didSwipeRef.current = false;
      }}
      onDragEnd={handleDragEnd}
      onTap={handleTap}
      animate={controls}
      whileTap={{ cursor: "grabbing" }}
    >
      {/* 予告編動画（背景） */}
      {videoUrl ? (
        <iframe
          ref={iframeRef}
          src={videoUrl}
          className={`absolute inset-0 h-full w-full rounded-3xl transition-opacity ${
            isVideoLoaded ? "opacity-100" : "opacity-0"
          }`}
          allow="autoplay; encrypted-media; accelerometer; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ pointerEvents: "none" }}
          onLoad={() => setIsVideoLoaded(true)}
        />
      ) : null}

      {/* ポスター画像（フォールバック or オーバーレイ） */}
      {posterUrl ? (
        <img
          src={posterUrl}
          alt={movie.title}
          className={`h-full w-full rounded-3xl object-cover transition-opacity ${
            videoUrl && isVideoLoaded ? "opacity-0" : "opacity-100"
          }`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-3xl bg-gray-900">
          <span className="text-sm text-gray-400">
            ポスター画像が見つかりません
          </span>
        </div>
      )}

      {/* 音声ON/OFFボタン */}
      {videoUrl && (
        <button
          type="button"
          onPointerDown={() => {
            // カード全体の onTap でインフォモーダルが開かないようにフラグを立てる
            ignoreTapRef.current = true;
          }}
          onClick={(e) => {
            e.stopPropagation();
            ignoreTapRef.current = true;
            const nextMuted = !isMuted;
            setIsMuted(nextMuted);
            // postMessage でミュート状態を制御（再生位置は維持）
            const iframe = iframeRef.current;
            if (iframe?.contentWindow && movie.video_key) {
              try {
                iframe.contentWindow.postMessage(
                  JSON.stringify({
                    event: "command",
                    func: nextMuted ? "mute" : "unMute"
                  }),
                  "*"
                );
              } catch {
                // postMessage失敗時は無視
              }
            }
          }}
          className="absolute top-4 right-4 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 transition-colors"
          aria-label={isMuted ? "音声をON" : "音声をOFF"}
        >
          {isMuted ? (
            <svg
              className="h-5 w-5"
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
              className="h-5 w-5"
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
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-3xl bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-24 pt-4 md:pb-8">
        <h2 className="text-lg font-semibold md:text-xl">{movie.title}</h2>
        {/* モバイル: 2行 / デスクトップ: 1行 */}
        <p
          className="mt-1 min-w-0 overflow-hidden text-xs text-gray-200 md:hidden"
          style={{
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2
          }}
        >
          {synopsis ?? getOneLineSynopsis(movie.overview)}
        </p>
        <p className="mt-1 hidden min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-gray-200 md:block md:text-sm">
          {synopsis ?? getOneLineSynopsis(movie.overview)}
        </p>
        <div className="mt-2 flex items-center justify-between text-xs text-gray-300 md:text-sm">
          <span>
            {movie.release_date ? movie.release_date.slice(0, 4) : "年不明"}
          </span>
          <span className="rounded-full bg-black/40 px-2 py-1 text-[10px] md:text-xs">
            ⭐ {movie.vote_average.toFixed(1)}
          </span>
        </div>
      </div>

      {/* モバイル版: カード内下部に BAD / Info / LIKE */}
      <div className="absolute inset-x-0 bottom-4 z-20 flex justify-center md:hidden">
        <div className="pointer-events-auto flex items-center gap-4">
          {/* BAD */}
          <button
            type="button"
            onPointerDown={() => {
              ignoreTapRef.current = true;
            }}
            onClick={(e) => {
              e.stopPropagation();
              ignoreTapRef.current = true;
              programmaticSwipe("left");
            }}
            className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-purple-500 bg-black/30 text-purple-400 hover:bg-purple-500/20 transition-colors"
            aria-label="BAD"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Info */}
          <button
            type="button"
            onPointerDown={() => {
              ignoreTapRef.current = true;
            }}
            onClick={(e) => {
              e.stopPropagation();
              ignoreTapRef.current = true;
              onInfoClick?.();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-gray-300/70 bg-black/30 text-gray-200 hover:bg-white/10 transition-colors"
            aria-label="詳細情報"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {/* LIKE */}
          <button
            type="button"
            onPointerDown={() => {
              ignoreTapRef.current = true;
            }}
            onClick={(e) => {
              e.stopPropagation();
              ignoreTapRef.current = true;
              programmaticSwipe("right");
            }}
            className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-pink-500 bg-black/30 text-pink-400 hover:bg-pink-500/20 transition-colors"
            aria-label="LIKE"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </button>
        </div>
      </div>
    </motion.div>
  );
}


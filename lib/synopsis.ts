/**
 * あらすじを1文にまとめる（情報量を少なく、感情が伝わる一行に）
 */
export function getOneLineSynopsis(overview: string | undefined): string {
  if (!overview?.trim()) return "あらすじ情報がありません。";
  const MAX = 56;
  const trimmed = overview.trim();
  const match = trimmed.match(/^[^。.]*[。.]/);
  const firstSentence = match ? match[0].trim() : trimmed;
  if (firstSentence.length <= MAX) return firstSentence;
  return firstSentence.slice(0, MAX) + "…";
}

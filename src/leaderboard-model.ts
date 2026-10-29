export type LeaderboardEntry = { player_id: string; nickname: string; score: number };
export function validateNickname(value: string): string {
  const nickname = value.trim().replace(/\s+/g, ' ');
  if (!/^[A-Za-z0-9 _-]{2,20}$/.test(nickname)) {
    throw new Error('Use 2–20 letters, numbers, spaces, underscores, or hyphens.');
  }
  return nickname;
}
export function validateScore(score: number): number {
  if (!Number.isSafeInteger(score) || score < 0 || score > 100000) throw new Error('Invalid score.');
  return score;
}

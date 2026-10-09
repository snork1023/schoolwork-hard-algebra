const STORAGE_PREFIX = "__schoolwork_game_progress_v1__:";

export function restoreGameStorage(gameUrl: string): void {
  const url = new URL(gameUrl, window.location.origin);
  const match = url.pathname.match(/^\/games\/([^/]+)\/index\.html$/);
  if (url.origin !== window.location.origin || !match) return;

  const gameId = decodeURIComponent(match[1]);
  if (!gameId || gameId.includes("/") || gameId === "." || gameId === "..") return;

  const prefix = `${STORAGE_PREFIX}${encodeURIComponent(gameId)}:`;
  const savedEntries: Array<[namespacedKey: string, gameKey: string, value: string]> = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const namespacedKey = localStorage.key(index);
    if (!namespacedKey?.startsWith(prefix)) continue;

    const gameKey = namespacedKey.slice(prefix.length);
    const value = localStorage.getItem(namespacedKey);
    if (value !== null) savedEntries.push([namespacedKey, gameKey, value]);
  }

  for (const [namespacedKey, gameKey, value] of savedEntries) {
    if (localStorage.getItem(gameKey) !== null) continue;

    localStorage.setItem(gameKey, value);
    localStorage.removeItem(namespacedKey);
  }
}

export interface BlacklistEntry {
  visitorId: string;
  reason: string;
  addedAt: string;
}

const globalBlacklist = globalThis as unknown as {
  __blacklistSet: Set<string>;
  __blacklistEntries: BlacklistEntry[];
};

if (!globalBlacklist.__blacklistSet) {
  globalBlacklist.__blacklistSet = new Set<string>();
}
if (!globalBlacklist.__blacklistEntries) {
  globalBlacklist.__blacklistEntries = [];
}

export function isBlacklisted(visitorId: string): boolean {
  return globalBlacklist.__blacklistSet.has(visitorId);
}

export function addToBlacklist(visitorId: string, reason = "Bot detected"): void {
  if (!globalBlacklist.__blacklistSet.has(visitorId)) {
    globalBlacklist.__blacklistSet.add(visitorId);
    globalBlacklist.__blacklistEntries.push({
      visitorId,
      reason,
      addedAt: new Date().toISOString(),
    });
  }
  console.warn(`[Blacklist] Dodano visitorId do blacklisty: ${visitorId} (${reason})`);
}

export function getBlacklist(): BlacklistEntry[] {
  return [...globalBlacklist.__blacklistEntries];
}

export function removeFromBlacklist(visitorId: string): boolean {
  if (!globalBlacklist.__blacklistSet.has(visitorId)) {
    return false;
  }
  globalBlacklist.__blacklistSet.delete(visitorId);
  const index = globalBlacklist.__blacklistEntries.findIndex(
    (e) => e.visitorId === visitorId,
  );
  if (index !== -1) {
    globalBlacklist.__blacklistEntries.splice(index, 1);
  }
  console.warn(`[Blacklist] Usunięto visitorId z blacklisty: ${visitorId}`);
  return true;
}

export function getBlacklistSize(): number {
  return globalBlacklist.__blacklistSet.size;
}

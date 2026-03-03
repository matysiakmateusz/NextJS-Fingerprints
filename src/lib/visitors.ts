export interface VisitorEntry {
  visitorId: string;
  confidence: number;
  requestId: string;
  botResult: string | null;
  timestamp: string;
  blocked: boolean;
  reason: string | null;
}

const globalVisitors = globalThis as unknown as {
  __visitors: VisitorEntry[];
};

if (!globalVisitors.__visitors) {
  globalVisitors.__visitors = [];
}

export function addVisitor(entry: VisitorEntry): void {
  globalVisitors.__visitors.push(entry);
}

export function getVisitors(): VisitorEntry[] {
  return [...globalVisitors.__visitors];
}

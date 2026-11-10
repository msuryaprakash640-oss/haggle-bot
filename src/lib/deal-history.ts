export type DealStatus = "approved" | "paid-demo" | "rejected" | "no-deal";

export interface DealRecord {
  id: string;
  product: string;
  seller: string;
  originalPrice: number;
  finalPrice?: number | undefined;
  savings: number;
  status: DealStatus;
  createdAt: string;
}

const KEY = "hagglebot.deals.v1";

export function loadDeals(): DealRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "[]") as DealRecord[];
  } catch {
    return [];
  }
}

function save(deals: DealRecord[]) {
  window.localStorage.setItem(KEY, JSON.stringify(deals.slice(0, 50)));
}

export function addDeal(d: Omit<DealRecord, "id" | "createdAt">): DealRecord {
  const rec: DealRecord = {
    ...d,
    id: Math.random().toString(36).slice(2, 10),
    createdAt: new Date().toISOString(),
  };
  save([rec, ...loadDeals()]);
  return rec;
}

export function updateDealStatus(id: string, status: DealStatus) {
  save(loadDeals().map((d) => (d.id === id ? { ...d, status } : d)));
}

export function clearDeals() {
  save([]);
}

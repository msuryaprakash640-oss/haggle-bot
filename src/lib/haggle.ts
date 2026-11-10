// Pure, deterministic simulation of product search, price comparison and negotiation.
// All seller responses are simulated. The bot never offers above the user's budget and
// only reports a deal when the final simulated price is within budget.

export type ProductId = "iphone" | "sony" | "nike" | "macbook" | "custom";

export interface Product {
  id: ProductId;
  name: string;
  short: string;
  tagline: string;
  keywords: string[];
  listPrice: number;
}

export const CATALOG: Product[] = [
  {
    id: "iphone",
    name: "Apple iPhone 17",
    short: "Apple iPhone",
    tagline: "Explore the best available offers.",
    keywords: ["iphone", "phone", "smartphone", "mobile"],
    listPrice: 79900,
  },
  {
    id: "sony",
    name: "Sony Wireless Headphones",
    short: "Sony Headphones",
    tagline: "Better sound. Better prices.",
    keywords: ["sony", "headphone", "headphones", "earphones", "earbuds", "audio"],
    listPrice: 9499,
  },
  {
    id: "nike",
    name: "Nike Running Sneakers",
    short: "Nike Sneakers",
    tagline: "Your style, your price.",
    keywords: ["nike", "sneaker", "sneakers", "shoe", "shoes", "running"],
    listPrice: 8995,
  },
  {
    id: "macbook",
    name: "Apple MacBook Air",
    short: "MacBook",
    tagline: "Premium technology, smarter spending.",
    keywords: ["macbook", "laptop", "mac", "notebook"],
    listPrice: 114900,
  },
];

export const SELLERS = ["NovaMart", "CircuitBay", "UrbanKart", "PixelHub"] as const;

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const roundDown = (n: number, step: number) => Math.floor(n / step) * step;
const roundUp = (n: number, step: number) => Math.ceil(n / step) * step;
/** Retail-style price, e.g. 9,499 */
const retail = (n: number) => Math.max(99, Math.round(n / 100) * 100 - 1);

export function formatINR(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

function titleCase(s: string) {
  return s
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function findProduct(query: string): Product {
  const q = query.toLowerCase();
  const words = new Set(q.split(/[^a-z0-9]+/).filter(Boolean));
  const match = CATALOG.find((p) => p.keywords.some((k) => words.has(k)));
  if (match) return match;
  const h = hashString(q.trim() || "deal");
  return {
    id: "custom",
    name: titleCase(query) || "Mystery Deal",
    short: titleCase(query) || "Mystery Deal",
    tagline: "Hand-picked by your AI agent.",
    keywords: [],
    listPrice: retail(1999 + (h % 50) * 600),
  };
}

export interface BudgetRange {
  min: number;
  max: number;
  step: number;
  suggested: number;
}

export function budgetRange(listPrice: number): BudgetRange {
  const step = listPrice >= 50000 ? 500 : 100;
  return {
    min: roundDown(listPrice * 0.5, step),
    max: roundUp(listPrice * 1.2, step),
    step,
    suggested: roundDown(listPrice * 0.85, step),
  };
}

export interface Offer {
  seller: string;
  price: number;
  rating: number;
  deliveryDays: number;
}

/** Simulated offers, sorted cheapest first. */
export function getOffers(product: Product, seed: number): Offer[] {
  const rng = seededRandom(seed);
  return SELLERS.map((seller, i) => {
    const mult = i === 0 ? 1 : 1 + rng() * 0.14;
    return {
      seller,
      price: retail(product.listPrice * mult),
      rating: Math.round((4 + rng() * 0.9) * 10) / 10,
      deliveryDays: 1 + Math.floor(rng() * 5),
    };
  }).sort((a, b) => a.price - b.price);
}

export type Speaker = "user" | "bot" | "seller";

export interface ChatMessage {
  role: Speaker;
  text: string;
  amount?: number;
}

export interface NegotiationResult {
  messages: ChatMessage[];
  success: boolean;
  /** Final agreed price. Only set when success is true (always <= budget). */
  finalPrice?: number | undefined;
  /** Seller's lowest simulated price, whether or not it fit the budget. */
  bestSellerPrice: number;
  startPrice: number;
  savings: number;
  seller: string;
  botOffers: number[];
}

export function negotiate(opts: {
  productName: string;
  offer: Offer;
  budget: number;
  seed: number;
}): NegotiationResult {
  const { productName, offer, budget, seed } = opts;
  const rng = seededRandom(seed ^ 0x9e3779b9);
  const best = offer.price;
  const floor = roundUp(best * (0.76 + rng() * 0.1), 50);
  const target = Math.min(budget, best);

  const clampToBudget = (n: number) => Math.min(budget, roundDown(n, 50));

  const opening = clampToBudget(Math.min(target, best * 0.72));
  const c1 = roundUp(best - (best - floor) * 0.5, 50);
  const o2 = clampToBudget(opening + (c1 - opening) * 0.35);
  const c2 = roundUp(best - (best - floor) * 0.8, 50);
  const o3 = clampToBudget(o2 + (c2 - o2) * 0.4);
  // If the seller's floor is below our last offer, they simply accept our offer.
  const acceptsOurs = floor <= o3;
  const final = acceptsOurs ? o3 : floor;
  const success = final <= budget;

  const f = formatINR;
  const messages: ChatMessage[] = [
    { role: "user", text: `I want ${productName} under ${f(budget)}.`, amount: budget },
    {
      role: "bot",
      text: `I found an offer at ${f(best)} from ${offer.seller}. Let's try negotiating for ${f(opening)}.`,
      amount: opening,
    },
    { role: "seller", text: `We can offer ${f(c1)}.`, amount: c1 },
    {
      role: "bot",
      text:
        c1 <= budget
          ? `That fits your budget, but I think there's more room. Countering at ${f(o2)}.`
          : `That's above your budget. Let me try one more offer — ${f(o2)}.`,
      amount: o2,
    },
    { role: "seller", text: `Hmm… we could stretch to ${f(c2)}.`, amount: c2 },
    {
      role: "bot",
      text: `Still pushing for you. Meet me at ${f(o3)}?`,
      amount: o3,
    },
    {
      role: "seller",
      text: acceptsOurs
        ? `You drive a hard bargain — ${f(final)} it is!`
        : `Our best simulated offer is ${f(final)}!`,
      amount: final,
    },
    {
      role: "bot",
      text: success
        ? `Great! That's within your budget — you save ${f(best - final)}. Would you like to review this deal?`
        : `${f(final)} is ${f(final - budget)} above your limit. I won't cross your budget, so no deal this time. Try raising your budget or another product.`,
    },
  ];

  return {
    messages,
    success,
    finalPrice: success ? final : undefined,
    bestSellerPrice: final,
    startPrice: best,
    savings: success ? best - final : 0,
    seller: offer.seller,
    botOffers: [opening, o2, o3],
  };
}

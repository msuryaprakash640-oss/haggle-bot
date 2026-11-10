// React Query hooks for the Haggle Bot backend. Each hook exposes loading state
// (isPending / isFetching) and a typed ApiError on failure. Not yet wired into the UI.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { unwrap } from "@/lib/api-result";
import type { CreatePaypalOrderInput, ProcessMessageInput, StartNegotiationInput } from "@/lib/backend/schemas";
import type { LiveCurrency } from "@/lib/channel3";
import {
  capturePaypalOrder,
  comparePrices,
  createPaypalOrder,
  getNegotiationHistory,
  getUserOrders,
  processNegotiationMessage,
  searchProducts,
  startNegotiation,
  verifyPayment,
} from "@/lib/haggle-api.functions";

const keys = {
  search: (q: string) => ["haggle", "search", q] as const,
  compare: (id: string) => ["haggle", "compare", id] as const,
  negotiations: ["haggle", "negotiations"] as const,
  negotiation: (id: string) => ["haggle", "negotiations", id] as const,
  orders: ["haggle", "orders"] as const,
};

export function useProductSearch(query: string) {
  const fn = useServerFn(searchProducts);
  const q = query.trim();
  return useQuery({ queryKey: keys.search(q), queryFn: () => unwrap(fn({ data: { query: q } })), enabled: q.length > 0 });
}

export function useComparePrices(productId: string | null, currency: LiveCurrency = "USD") {
  const fn = useServerFn(comparePrices);
  return useQuery({
    queryKey: [...keys.compare(productId ?? ""), currency],
    queryFn: () => {
      if (!productId) throw new Error("Choose a product first.");
      return unwrap(fn({ data: { productId, currency } }));
    },
    enabled: !!productId,
  });
}

export function useNegotiationHistory(negotiationId?: string) {
  const fn = useServerFn(getNegotiationHistory);
  return useQuery({
    queryKey: negotiationId ? keys.negotiation(negotiationId) : keys.negotiations,
    queryFn: () => unwrap(fn({ data: negotiationId ? { negotiationId } : {} })),
  });
}

export function useUserOrders() {
  const fn = useServerFn(getUserOrders);
  return useQuery({ queryKey: keys.orders, queryFn: () => unwrap(fn({ data: {} })) });
}

export function useStartNegotiation() {
  const fn = useServerFn(startNegotiation);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StartNegotiationInput) => unwrap(fn({ data: input })),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.negotiations }),
  });
}

export function useSendNegotiationMessage() {
  const fn = useServerFn(processNegotiationMessage);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProcessMessageInput) => unwrap(fn({ data: input })),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.negotiations }),
  });
}

export function useCreatePaypalOrder() {
  const fn = useServerFn(createPaypalOrder);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePaypalOrderInput) => unwrap(fn({ data: input })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.orders });
      void qc.invalidateQueries({ queryKey: keys.negotiations });
    },
  });
}

export function useCapturePaypalOrder() {
  const fn = useServerFn(capturePaypalOrder);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => unwrap(fn({ data: { orderId } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.orders }),
  });
}

export function useVerifyPayment() {
  const fn = useServerFn(verifyPayment);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => unwrap(fn({ data: { orderId } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.orders }),
  });
}

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AssistanceInput } from "./gemini-negotiation";

export const geminiAssist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AssistanceInput) => input)
  .handler(async ({ data, context }) => {
    const { assist } = await import("./backend/gemini-assistance.server");
    return assist(context, data);
  });

export const getGeminiHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Pick<AssistanceInput, "productId" | "budget" | "currency">) => input)
  .handler(async ({ data, context }) => {
    const { assistanceHistory } = await import("./backend/gemini-assistance.server");
    return assistanceHistory(context, data);
  });
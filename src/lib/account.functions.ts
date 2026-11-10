import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { profileSchema } from "./auth-validation";

export const saveAccountProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fullName: string }) => profileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("profiles").upsert({
      id: context.userId, full_name: data.fullName,
      email: typeof context.claims.email === "string" ? context.claims.email : null,
    });
    if (error) throw new Error("Your account is signed in, but the profile could not be saved. Please retry.");
    return { saved: true };
  });
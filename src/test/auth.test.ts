import { describe, expect, it } from "vitest";
import { needsSignIn, signUpSchema, signInSchema } from "@/lib/auth-validation";
describe("Shopper accounts", () => {
  const account = { fullName: "Surya Prakash", email: "surya@example.com", password: "AsecurePassword9", confirmPassword: "AsecurePassword9" };
  it("requires the requested full name", () => { expect(signUpSchema.safeParse({ ...account, fullName: " " }).success).toBe(false); });
  it("requires a valid email address", () => { expect(signInSchema.safeParse({ email: "not-an-email", password: "password" }).success).toBe(false); });
  it("requires matching password confirmation", () => { expect(signUpSchema.safeParse({ ...account, confirmPassword: "different" }).success).toBe(false); });
  it("accepts the requested signup fields", () => { expect(signUpSchema.parse(account).fullName).toBe("Surya Prakash"); });
  it("blocks negotiation starts for signed-out users", () => { expect(needsSignIn(null)).toBe(true); });
  it("allows authenticated users to start", () => { expect(needsSignIn({ id: "shopper" })).toBe(false); });
});
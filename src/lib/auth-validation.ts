import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(255),
  password: z.string().min(1, "Enter your password.").max(128),
});
export const signUpSchema = signInSchema.extend({
  fullName: z.string().trim().min(1, "Enter your full name.").max(200, "Name must be 200 characters or fewer."),
  password: z.string().min(8, "Use at least 8 characters.").max(128),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match." });
export const profileSchema = z.object({ fullName: z.string().trim().min(1).max(200) });
export function needsSignIn(user: { id: string } | null) { return user === null; }

export function authErrorMessage(code?: string) {
  switch (code) {
    case "invalid_credentials": return "Email or password is incorrect.";
    case "email_not_confirmed": return "Confirm your email before signing in.";
    case "user_already_exists": return "An account already exists. Please sign in.";
    case "signup_disabled": return "New accounts are currently disabled. Please contact the site owner.";
    case "email_provider_disabled": return "Email sign-in is not enabled. The site owner needs to enable it in Supabase.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit": return "Too many attempts. Please wait before trying again.";
    case "weak_password": return "Choose a stronger password that meets the account security requirements.";
    default: return "The request could not be completed. Please try again.";
  }
}
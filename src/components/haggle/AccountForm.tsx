import { useState } from "react";
import { Link, useNavigate, useHydrated } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, LoaderCircle, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authErrorMessage, signInSchema, signUpSchema } from "@/lib/auth-validation";
import { saveAccountProfile } from "@/lib/account.functions";

export function AccountForm({ signUp = false }: { signUp?: boolean }) {
  const hydrated = useHydrated();
  const navigate = useNavigate();
  const saveProfile = useServerFn(saveAccountProfile);
  const [values, setValues] = useState({ fullName: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [profileRetry, setProfileRetry] = useState(false);
  const submit = async () => {
    const parsed = (signUp ? signUpSchema : signInSchema).safeParse(values);
    if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map(i => [String(i.path[0]), i.message]))); return; }
    setErrors({}); setPending(true);
    try {
      if (profileRetry) {
        await saveProfile({ data: { fullName: values.fullName.trim() } });
      } else if (signUp) {
        const { data, error } = await supabase.auth.signUp({ email: values.email.trim(), password: values.password, options: { data: { full_name: values.fullName.trim() }, emailRedirectTo: `${window.location.origin}/auth` } });
        if (error) { setErrors({ form: authErrorMessage(error.code) }); return; }
        if (!data.session) { setValues(v => ({ ...v, password: "", confirmPassword: "" })); setConfirmation(true); return; }
        setProfileRetry(true);
        await saveProfile({ data: { fullName: values.fullName.trim() } });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: values.email.trim(), password: values.password });
        if (error) { setErrors({ form: authErrorMessage(error.code) }); return; }
      }
      setValues(v => ({ ...v, password: "", confirmPassword: "" }));
      await navigate({ to: "/dashboard", replace: true });
    } catch (error) { setErrors({ form: profileRetry || signUp ? "Your request could not be completed. If your account was created, sign in to continue; otherwise retry." : "Sign-in is unavailable. Please try again." }); }
    finally { setPending(false); }
  };
  const field = (key: keyof typeof values, label: string, type: string, autoComplete: string) => <div>
    <label htmlFor={key} className="mb-2 block text-sm font-semibold">{label}</label>
    <div className="relative">
      <Input id={key} type={type === "password" && visible ? "text" : type} autoComplete={autoComplete} maxLength={key === "fullName" ? 200 : key === "email" ? 255 : 128} value={values[key]} disabled={pending || profileRetry} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `${key}-error` : undefined} onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))} className={type === "password" ? "h-12 pr-12" : "h-12"} />
      {type === "password" && <Button disabled={!hydrated} type="button" variant="ghost" size="icon" className="absolute right-1 top-1.5" title={visible ? "Hide passwords" : "Show passwords"} aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(v => !v)}>{visible ? <EyeOff /> : <Eye />}</Button>}
    </div>
    {errors[key] && <p id={`${key}-error`} className="mt-2 text-sm text-destructive">{errors[key]}</p>}
  </div>;
  return <section className="mx-auto max-w-md px-4 py-16 sm:py-20">
    <p className="font-mono text-xs uppercase text-primary">Haggle Bot · Your account</p>
    <h1 className="mt-4 font-display text-3xl font-bold">{confirmation ? "Check your email" : signUp ? "Create your account" : "Welcome back"}</h1>
    {confirmation ? <div className="mt-8 space-y-5"><MailCheck className="size-10 text-primary" /><p className="text-muted-foreground">If registration is available for this email, a confirmation link will arrive shortly. Confirm your email to continue to your dashboard.</p><Button asChild variant="neon"><Link to="/auth">Go to Sign In</Link></Button></div> : <>
      <form noValidate className="mt-8 space-y-5" onSubmit={e => { e.preventDefault(); void submit(); }}>
        {signUp && field("fullName", "Full name", "text", "name")}
        {field("email", "Email address", "email", "email")}
        {field("password", "Password", "password", signUp ? "new-password" : "current-password")}
        {signUp && field("confirmPassword", "Confirm password", "password", "new-password")}
        {errors["form"] && <p role="alert" className="text-sm text-destructive">{errors["form"]}</p>}
        <Button variant="hero" size="xl" className="w-full" disabled={pending || !hydrated}>{pending && <LoaderCircle className="animate-spin" />}{profileRetry ? "Retry profile save" : signUp ? "Create Account" : "Sign In"}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">{signUp ? "Already have an account? " : "New to Haggle Bot? "}<Link className="font-semibold text-primary hover:underline" to={signUp ? "/auth" : "/sign-up"}>{signUp ? "Sign In" : "Sign Up"}</Link></p>
    </>}
  </section>;
}
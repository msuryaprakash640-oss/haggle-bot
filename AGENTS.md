<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Shopper accounts share one root AccountProvider listener; private dashboard/history/orders live under the Supabase-authenticated layout, while Channel3 discovery remains public, to avoid competing sessions and protect personal data.
- Account profiles reuse the existing signup trigger and authenticated RLS upsert; no alternative credential store or auto-confirm override is allowed.
- Personal negotiation history reads Supabase-owned rows; browser-only demo history is not presented as account history, to avoid showing another device user's records.
- Negotiation/search simulation lives as pure deterministic functions in `src/lib/haggle.ts`, covered by `src/test/haggle.test.ts` — keeps budget rules testable without UI.
- Deal history is still stored in browser localStorage via `src/lib/deal-history.ts` — read it only in effects to avoid hydration mismatches. The Supabase schema (profiles, products, retailer_offers, negotiations, negotiation_messages, orders) exists but the UI is not wired to it yet.
- Order payment_status changes only via service_role (server code after PayPal confirmation); authenticated users can only insert pending orders — prevents self-marking orders as paid.
- Budget protection is also enforced in the DB (opening_offer CHECK, validate_order trigger) so no layer can record a deal above the user's budget.
- Haggle UI pieces live in `src/components/haggle/`; animations use `motion` and confetti is dynamically imported client-side.
- Channel3 requests extend the existing search/compare server functions; only validated provider data may be saved with service-role access, never browser-supplied catalog rows.
- Channel3 offer IDs use one shared deterministic UUID helper (`channel3-offer-id.ts`) from product, currency, retailer and stable offer identity, and live comparisons return that same stored ID, so checkout can load the trusted row; unavailable or unknown availability is not fabricated.
- Live discovery is separate from simulated negotiation and uses supported native currencies without exchange-rate conversion; provider failures never silently return demo results.
- Temporary search limiting is per-worker best effort only, not durable shared state or an abuse-prevention guarantee.
- Gemini assistance uses separate authenticated TanStack server functions and existing negotiation tables; verified Channel3 rows are read-only context, and Gemini sessions never enter deal-found/payment states. This isolates advice from existing catalog, demo and PayPal behavior.
- Gemini history is scoped by authenticated user, product, budget and currency, while demo deal summaries remain localStorage-only; this prevents mixing AI drafts with demo purchases.
- PayPal reuses the existing authenticated payment operations through the Sandbox connector gateway; pure validation in paypal-validation.ts and stable per-order create/capture request IDs protect trusted listed prices and retries, and the existing orders table stores a unique capture reference.
- Listed-price Sandbox checkouts create separate comparing negotiations rather than approving Gemini conversations; seller advice and simulated acceptance cannot authorize discounted payments.

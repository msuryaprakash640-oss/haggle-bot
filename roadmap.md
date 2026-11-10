# Channel3 integration
## PayPal Sandbox
- [x] Inspect local Edge Function inventory and deployed create-paypal-order (404); reuse existing TanStack payment operations. Sandbox connector linked and app credential path returned HTTP 200.
- [x] Add trusted listed-price checkout, PayPal approval, verified capture and stable per-order idempotency protection; Gemini conversations unchanged.
- [x] Add unique capture reference to existing orders and confirmation, cancellation and failure presentation. Cancelled approval remains pending/unpaid, never captured automatically.
- [x] Verify 43 tests, live Channel3 comparison, signed-out checkout entry and private confirmation redirect at desktop/390px; no overflow, latest build OK.
- [ ] Capture and verify a real Sandbox payment and signed-in order persistence — blocked by external unmanaged Supabase without an authenticated test session and buyer approval. Integration success is not claimed.
- Existing Supabase leaked-password protection warning predates this change; no auth settings changed.

## Shopper accounts
- [x] Add sign-up/sign-in with validation, password visibility and existing profile storage.
- [x] Add dashboard, sign-out and private history/orders; gate negotiation starts.
- [x] Verify 36 tests, desktop/mobile forms, password toggle, signed-out page redirects and demo start blocking; current build OK.
- [ ] Verify actual registration/email confirmation, login, logout and signed-in history/orders — blocked by external unmanaged Supabase without an available authenticated test session.

### Account verification
- Hosted Supabase public settings verified: email/password enabled, signup enabled, email confirmation required. No auth configuration was changed.
- Existing profile trigger is enabled and stores full_name/email; authenticated SELECT/INSERT/UPDATE privileges verified.
- Confirm email links must allow the preview origin followed by /auth, and the published origin followed by /auth after publishing, in Supabase Authentication URL Configuration.
- Personal history now reads the existing Supabase negotiations table; shared browser demo history is not treated as account history.

- [x] Verify official Channel3 endpoints, response fields, currencies and offer coverage.
- [x] Securely configure CHANNEL3_API_KEY as a server-only project secret (existing TanStack functions, not Edge Functions).
- [x] Connect homepage live search and comparison while preserving explicit demo mode.
- [x] Update existing product and retailer-offer records without duplicates; verified 23 unique products and 31 offers after repeated searches.
- [x] Validate inputs, handle provider errors and confirm rate-limit approach (approved per-worker best effort, 10 calls/minute).
- [x] Test real searches, budget filtering, images, empty results, multiple supplied retailer offers, desktop/mobile and preserved demo; 18 tests passed.

## Verified limitations
- Channel3 rejects INR; live search uses its ten supported currencies with no invented conversion. Demo retains INR.
- Rate limiting is temporary per-worker protection, not a globally shared abuse-control guarantee.
- Provider validation errors (422) were observed with real calls; other provider status handlers are implemented but their live failures were not induced.
- Existing tables/functions were not recreated. Seller acceptance remains unconnected; PayPal Sandbox is linked but actual capture verification remains blocked as listed above.

## Gemini assistance
- [x] Inspect existing schema, negotiation interface and available server functions; no local Supabase Edge Functions exist.
- [x] Add secure Gemini assistance using existing tables, verified Channel3 records and budget validation.
- [x] Connect the existing chat presentation, sign-in and saved history without modifying Channel3 or PayPal logic.
- [x] Test budget/simulation safeguards, provider errors and public browser workflow; 29 tests pass and real Gemini advice verified.
- [ ] Verify authenticated chat writes, reload and history through the real UI — blocked by external unmanaged Supabase, with no test session available.

## Gemini verification and limitations
- Real Gemini model call returned a $10 target for an $11.79 listed product within a $15 budget and a polite draft; no seller or payment action.
- Actual Channel3 live search and comparison still work; Gemini sign-in section checked at desktop and 390px phone width, no horizontal overflow or page errors.
- GEMINI_API_KEY is configured securely in the app server. TanStack server functions are required here, so Supabase Edge Functions and Deno.env were not implemented.
- Existing tables and PayPal logic are unchanged. Gemini sessions remain negotiating/draft-only and cannot be paid through the existing deal-found checkout path.
- Authenticated persistence is implemented but not end-to-end verified; external sign-in/signup settings are unverified.
- Quota, missing-key, unsafe output and network errors tested with controlled responses; live provider failures not induced.
- No durable per-user Gemini quota was added, and multi-write persistence is not atomic without a database change; provider quota limits still apply.
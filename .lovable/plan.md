# Haggle Bot database setup

Adds six tables to your connected Supabase project. Nothing on the website changes: pages, design and the demo keep working exactly as now. Hooking the site up to these tables (and adding sign-in) is a separate later step.

## Tables

| Table | What it holds | Belongs to |
|---|---|---|
| profiles | Name and email for each signed-in shopper, created automatically at sign-up | One per user |
| products | Product catalog (name, brand, image, description, outside product ID) | Shared, public |
| retailer_offers | Each store's price for a product, currency, link, stock status | Shared, public |
| negotiations | One haggling session: product, budget, opening offer, latest offer, status | The shopper |
| negotiation_messages | Every chat line (you / bot / seller) with any amount offered | Through its negotiation |
| orders | An approved deal: original price, approved price, payment status, PayPal order reference | The shopper |

Every table also gets `updated_at`, which stays current automatically.

## Who can see and change what

| Table | Anyone (signed out) | Signed-in shopper | Server only |
|---|---|---|---|
| profiles | nothing | view and edit **own** profile only | everything |
| products | view | view | add / edit / remove |
| retailer_offers | view | view | add / edit / remove |
| negotiations | nothing | view, start, update and delete **own** only | everything |
| negotiation_messages | nothing | view and add messages in **own** negotiations only; messages can't be edited | everything |
| orders | nothing | view **own** orders; create own order as "pending" | mark as paid, failed or refunded |

Shoppers can never mark their own order as paid. Only trusted server code (for example, after PayPal confirms payment) can change payment status.

## Rules the database itself enforces

- All prices, budgets and offers must be greater than zero. Money is stored with two decimals (up to 9,999,999,999.99).
- Currency is a 3-letter code, defaulting to INR.
- **Budget protection:** the bot's opening offer can't exceed the shopper's budget, and an order's approved price can't exceed the budget of its negotiation. This backs up the "never above your budget" rule at the database level.
- An order's approved price can't be above its original price.
- One order per negotiation; each PayPal order reference can be used only once.
- An order must belong to the same shopper as its negotiation.
- Allowed values:
  - stock status: in stock, limited, out of stock, preorder
  - negotiation status: searching, comparing, negotiating, deal found, no deal, approved, rejected, cancelled
  - message sender: user, bot, seller
  - payment status: pending, paid, failed, refunded, cancelled
- Deleting an account removes its profile, negotiations, messages and orders. Deleting a product removes its store offers.
- No card details or PayPal secrets are stored. Only the PayPal order ID, a public reference, is kept.

## After approval

1. Run the migration.
2. Check that all six tables, policies, rules and triggers exist. Try a few writes that should be blocked (a negative price, an over-budget order) to confirm they fail.
3. Run the Supabase security check and fix anything it flags.

## Technical details

- Single migration. For each table, in order: CREATE TABLE, then GRANT, then ENABLE RLS, then policies.
- Grants: `anon` gets SELECT on products and retailer_offers only. `authenticated` gets the operations its policies allow. `service_role` gets ALL.
- `profiles.id` references `auth.users(id)` ON DELETE CASCADE. `negotiations.user_id` and `orders.user_id` reference `profiles(id)` ON DELETE CASCADE. `negotiation_id` and `product_id` FKs cascade, except `orders.negotiation_id`, which uses RESTRICT so an order's record can't vanish with its negotiation.
- `handle_new_user()` is a SECURITY DEFINER trigger on `auth.users`. It inserts a profile with `full_name` taken from the sign-up metadata.
- Fixed value lists use CHECK constraints. Comparisons across tables (approved price within budget, matching owner) use a `BEFORE INSERT OR UPDATE` validation trigger on orders.
- Indexes: `products.external_product_id` (unique); `retailer_offers(product_id)`; `negotiations(user_id, created_at desc)` and `(product_id)`; `negotiation_messages(negotiation_id, created_at)`; `orders(user_id, created_at desc)`; unique on `orders.negotiation_id` and `orders.paypal_order_id`.
- Message ownership checks go through a `SECURITY DEFINER` helper, `owns_negotiation(uuid)`, so policies don't recurse.
- AGENTS.md gets a note that the schema exists while the frontend still uses localStorage.

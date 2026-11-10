REVOKE ALL ON public.profiles, public.products, public.retailer_offers, public.negotiations, public.negotiation_messages, public.orders FROM anon, authenticated;

GRANT SELECT ON public.products, public.retailer_offers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.negotiations TO authenticated;
GRANT SELECT, INSERT ON public.negotiation_messages TO authenticated;
GRANT SELECT, INSERT ON public.orders TO authenticated;

GRANT ALL ON public.profiles, public.products, public.retailer_offers, public.negotiations, public.negotiation_messages, public.orders TO service_role;
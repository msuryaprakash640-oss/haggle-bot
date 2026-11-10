-- Shared updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 1. profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text CHECK (full_name IS NULL OR char_length(full_name) <= 200),
  email text CHECK (email IS NULL OR char_length(email) <= 320),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users create own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, NULLIF(left(NEW.raw_user_meta_data->>'full_name', 200), ''), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. products
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_product_id text UNIQUE,
  product_name text NOT NULL CHECK (char_length(product_name) BETWEEN 1 AND 300),
  brand text,
  image_url text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products are publicly viewable" ON public.products
  FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. retailer_offers
CREATE TABLE public.retailer_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  retailer_name text NOT NULL CHECK (char_length(retailer_name) BETWEEN 1 AND 200),
  original_price numeric(12,2) NOT NULL CHECK (original_price > 0),
  currency char(3) NOT NULL DEFAULT 'INR' CHECK (currency ~ '^[A-Z]{3}$'),
  product_url text,
  availability_status text NOT NULL DEFAULT 'in_stock'
    CHECK (availability_status IN ('in_stock','limited','out_of_stock','preorder')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_retailer_offers_product ON public.retailer_offers(product_id);
GRANT SELECT ON public.retailer_offers TO anon, authenticated;
GRANT ALL ON public.retailer_offers TO service_role;
ALTER TABLE public.retailer_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Retailer offers are publicly viewable" ON public.retailer_offers
  FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER update_retailer_offers_updated_at BEFORE UPDATE ON public.retailer_offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. negotiations
CREATE TABLE public.negotiations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_budget numeric(12,2) NOT NULL CHECK (user_budget > 0),
  opening_offer numeric(12,2) CHECK (opening_offer > 0),
  current_offer numeric(12,2) CHECK (current_offer > 0),
  negotiation_status text NOT NULL DEFAULT 'searching'
    CHECK (negotiation_status IN ('searching','comparing','negotiating','deal_found','no_deal','approved','rejected','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opening_offer_within_budget CHECK (opening_offer IS NULL OR opening_offer <= user_budget)
);
CREATE INDEX idx_negotiations_user_created ON public.negotiations(user_id, created_at DESC);
CREATE INDEX idx_negotiations_product ON public.negotiations(product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.negotiations TO authenticated;
GRANT ALL ON public.negotiations TO service_role;
ALTER TABLE public.negotiations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own negotiations" ON public.negotiations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own negotiations" ON public.negotiations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own negotiations" ON public.negotiations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own negotiations" ON public.negotiations
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_negotiations_updated_at BEFORE UPDATE ON public.negotiations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.owns_negotiation(_negotiation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.negotiations
    WHERE id = _negotiation_id AND user_id = auth.uid()
  )
$$;
REVOKE EXECUTE ON FUNCTION public.owns_negotiation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_negotiation(uuid) TO authenticated, service_role;

-- 5. negotiation_messages
CREATE TABLE public.negotiation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negotiation_id uuid NOT NULL REFERENCES public.negotiations(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('user','bot','seller')),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 4000),
  offer_amount numeric(12,2) CHECK (offer_amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_negotiation_messages_negotiation ON public.negotiation_messages(negotiation_id, created_at);
GRANT SELECT, INSERT ON public.negotiation_messages TO authenticated;
GRANT ALL ON public.negotiation_messages TO service_role;
ALTER TABLE public.negotiation_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view messages in own negotiations" ON public.negotiation_messages
  FOR SELECT TO authenticated USING (public.owns_negotiation(negotiation_id));
CREATE POLICY "Users add messages to own negotiations" ON public.negotiation_messages
  FOR INSERT TO authenticated WITH CHECK (public.owns_negotiation(negotiation_id));
CREATE TRIGGER update_negotiation_messages_updated_at BEFORE UPDATE ON public.negotiation_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. orders
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  negotiation_id uuid NOT NULL UNIQUE REFERENCES public.negotiations(id) ON DELETE RESTRICT,
  original_price numeric(12,2) NOT NULL CHECK (original_price > 0),
  approved_price numeric(12,2) NOT NULL CHECK (approved_price > 0),
  currency char(3) NOT NULL DEFAULT 'INR' CHECK (currency ~ '^[A-Z]{3}$'),
  payment_status text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending','paid','failed','refunded','cancelled')),
  paypal_order_id text UNIQUE CHECK (paypal_order_id IS NULL OR char_length(paypal_order_id) <= 64),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT approved_not_above_original CHECK (approved_price <= original_price)
);
CREATE INDEX idx_orders_user_created ON public.orders(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own orders" ON public.orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own pending orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND payment_status = 'pending' AND paypal_order_id IS NULL);
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cross-table validation: owner match and budget protection
CREATE OR REPLACE FUNCTION public.validate_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n_user uuid;
  n_budget numeric(12,2);
BEGIN
  SELECT user_id, user_budget INTO n_user, n_budget
  FROM public.negotiations WHERE id = NEW.negotiation_id;
  IF n_user IS NULL THEN
    RAISE EXCEPTION 'Negotiation not found';
  END IF;
  IF n_user <> NEW.user_id THEN
    RAISE EXCEPTION 'Order must belong to the same user as its negotiation';
  END IF;
  IF NEW.approved_price > n_budget THEN
    RAISE EXCEPTION 'Approved price % exceeds budget %', NEW.approved_price, n_budget;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.validate_order() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validate_order_before_write BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_order();
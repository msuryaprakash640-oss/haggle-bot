ALTER TABLE public.negotiations
  ADD COLUMN retailer_offer_id uuid REFERENCES public.retailer_offers(id) ON DELETE SET NULL;
CREATE INDEX idx_negotiations_retailer_offer ON public.negotiations(retailer_offer_id);

ALTER TABLE public.orders DROP CONSTRAINT orders_negotiation_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_negotiation_id_fkey
  FOREIGN KEY (negotiation_id) REFERENCES public.negotiations(id) ON DELETE NO ACTION;

DROP POLICY "Users create own negotiations" ON public.negotiations;
DROP POLICY "Users update own negotiations" ON public.negotiations;
DROP POLICY "Users add messages to own negotiations" ON public.negotiation_messages;
DROP POLICY "Users create own pending orders" ON public.orders;
REVOKE INSERT, UPDATE ON public.negotiations FROM authenticated;
REVOKE INSERT ON public.negotiation_messages FROM authenticated;
REVOKE INSERT ON public.orders FROM authenticated;

INSERT INTO public.products (external_product_id, product_name, brand, description) VALUES
  ('demo:iphone-17', 'Apple iPhone 17', 'Apple', 'Demo listing - sellers and prices are simulated.'),
  ('demo:sony-wh', 'Sony Wireless Headphones', 'Sony', 'Demo listing - sellers and prices are simulated.'),
  ('demo:nike-run', 'Nike Running Sneakers', 'Nike', 'Demo listing - sellers and prices are simulated.'),
  ('demo:macbook-air', 'Apple MacBook Air', 'Apple', 'Demo listing - sellers and prices are simulated.');

INSERT INTO public.retailer_offers (product_id, retailer_name, original_price, currency, availability_status)
SELECT p.id, o.retailer, o.price, 'INR', o.status
FROM public.products p
JOIN (VALUES
  ('demo:iphone-17', 'NovaMart', 79900, 'in_stock'),
  ('demo:iphone-17', 'CircuitBay', 82499, 'in_stock'),
  ('demo:iphone-17', 'UrbanKart', 84999, 'limited'),
  ('demo:iphone-17', 'PixelHub', 86999, 'in_stock'),
  ('demo:sony-wh', 'NovaMart', 9499, 'in_stock'),
  ('demo:sony-wh', 'CircuitBay', 9899, 'in_stock'),
  ('demo:sony-wh', 'UrbanKart', 10299, 'limited'),
  ('demo:sony-wh', 'PixelHub', 10799, 'out_of_stock'),
  ('demo:nike-run', 'NovaMart', 8999, 'in_stock'),
  ('demo:nike-run', 'CircuitBay', 9399, 'in_stock'),
  ('demo:nike-run', 'UrbanKart', 9799, 'in_stock'),
  ('demo:nike-run', 'PixelHub', 10199, 'limited'),
  ('demo:macbook-air', 'NovaMart', 114900, 'in_stock'),
  ('demo:macbook-air', 'CircuitBay', 119900, 'in_stock'),
  ('demo:macbook-air', 'UrbanKart', 122999, 'limited'),
  ('demo:macbook-air', 'PixelHub', 126499, 'in_stock')
) AS o(ext, retailer, price, status) ON o.ext = p.external_product_id;
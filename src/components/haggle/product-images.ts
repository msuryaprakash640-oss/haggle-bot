import phone from "@/assets/deal-phone.jpg";
import headphones from "@/assets/deal-headphones.jpg";
import sneakers from "@/assets/deal-sneakers.jpg";
import laptop from "@/assets/deal-laptop.jpg";
import type { ProductId } from "@/lib/haggle";

export const PRODUCT_IMAGES: Partial<Record<ProductId, string>> = {
  iphone: phone,
  sony: headphones,
  nike: sneakers,
  macbook: laptop,
};

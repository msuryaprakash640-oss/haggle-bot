import { describe, expect, it } from "vitest";
import { channel3OfferId } from "@/lib/channel3-offer-id";
import { createPaypalOrderSchema } from "@/lib/backend/schemas";

const offer = { retailer: "Best Buy", currency: "USD", url: "https://buy.trychannel3.com/a?o=offer-1&aid=x" };

describe("Channel3 offer ids used for PayPal checkout", () => {
  it("produces an id the checkout request accepts", async () => {
    const id = await channel3OfferId("channel3:prod-123", offer);
    expect(createPaypalOrderSchema.safeParse({ retailerOfferId: id, budget: 100 }).success).toBe(true);
  });
  it("is the same id every time for the same retailer offer", async () => {
    expect(await channel3OfferId("channel3:prod-123", offer)).toBe(await channel3OfferId("channel3:prod-123", { ...offer, url: "https://buy.trychannel3.com/a?o=offer-1&aid=y" }));
  });
  it("rejects the old position-based comparison label at checkout", () => {
    expect(createPaypalOrderSchema.safeParse({ retailerOfferId: "channel3:prod-123:0", budget: 100 }).success).toBe(false);
  });
});

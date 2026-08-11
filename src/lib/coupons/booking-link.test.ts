import { describe, expect, it } from "vitest";
import { buildPreappliedCouponUrl } from "./booking-link";

describe("buildPreappliedCouponUrl", () => {
  it("creates the reservation URL with the normalized coupon pre-applied", () => {
    expect(buildPreappliedCouponUrl(" volte10-abc 123 ", "https://pousadadelplata.com.br/admin"))
      .toBe("https://pousadadelplata.com.br/reservar?promo=VOLTE10-ABC123");
  });

  it("does not allow an unsafe configured protocol", () => {
    expect(buildPreappliedCouponUrl("VOLTE10-ABC123", "javascript:alert(1)"))
      .toBe("https://www.pousadadelplata.com.br/reservar?promo=VOLTE10-ABC123");
  });
});

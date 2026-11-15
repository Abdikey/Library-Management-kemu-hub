import { describe, it, expect } from "vitest";
import { normalizeKenyanPhone, payableAmount, darajaTimestamp } from "./mpesa";

describe("mpesa helpers", () => {
  it("accepts 07.. numbers as 2547..", () => expect(normalizeKenyanPhone("0712 345 678")).toBe("254712345678"));
  it("accepts +254 and 01.. numbers", () => {
    expect(normalizeKenyanPhone("+254110000001")).toBe("254110000001");
    expect(normalizeKenyanPhone("0110000001")).toBe("254110000001");
  });
  it("rejects invalid numbers", () => expect(normalizeKenyanPhone("12345")).toBeNull());
  it("charges whole shillings of the recorded fine", () => {
    expect(payableAmount(50)).toBe(50);
    expect(payableAmount(0)).toBe(0);
  });
  it("uses Kenya time for the timestamp", () =>
    expect(darajaTimestamp(new Date("2026-11-14T22:30:05Z"))).toBe("20261115013005"));
});

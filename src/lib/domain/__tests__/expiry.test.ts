import { describe, expect, it } from "vitest";
import { expiryStatus, daysUntil } from "@/lib/domain/expiry";

const now = new Date("2026-06-13T12:00:00");

describe("daysUntil", () => {
  it("counts whole calendar days", () => {
    expect(daysUntil(new Date("2026-06-13T23:00:00"), now)).toBe(0);
    expect(daysUntil(new Date("2026-06-16T01:00:00"), now)).toBe(3);
    expect(daysUntil(new Date("2026-06-12T01:00:00"), now)).toBe(-1);
  });
});

describe("expiryStatus", () => {
  it("returns null when there's no expiry date", () => {
    expect(expiryStatus(null, now)).toBeNull();
  });

  it("flags past dates as expired (today is not expired)", () => {
    expect(expiryStatus(new Date("2026-06-12"), now)).toBe("expired");
    expect(expiryStatus(new Date("2026-06-13T20:00:00"), now)).toBe("soon");
  });

  it("flags within the soon window, otherwise ok", () => {
    expect(expiryStatus(new Date("2026-06-18"), now)).toBe("soon"); // 5 days
    expect(expiryStatus(new Date("2026-06-25"), now)).toBe("ok"); // 12 days
  });
});

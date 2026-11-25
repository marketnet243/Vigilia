import { describe, expect, it } from "vitest";
import { publicOrigin } from "@/lib/telegram/webhook-url";

describe("Telegram webhook origin", () => {
  it("swaps the private preview host for the public dev host", () => {
    expect(publicOrigin("https://id-preview--abc-123.lovable.app")).toBe("https://project--abc-123-dev.lovable.app");
  });
  it("keeps published origins unchanged", () => {
    expect(publicOrigin("https://vigilia.lovable.app")).toBe("https://vigilia.lovable.app");
  });
});

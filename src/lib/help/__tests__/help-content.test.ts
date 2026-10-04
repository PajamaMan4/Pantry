import { describe, expect, it } from "vitest";
import { GUIDE_TOPIC_ORDER, HELP_TOPIC_IDS, helpTopics } from "@/lib/help";

describe("helpTopics", () => {
  it("has exactly one topic per declared id, and no orphans", () => {
    const keys = Object.keys(helpTopics).sort();
    const ids = [...HELP_TOPIC_IDS].sort();
    expect(keys).toEqual(ids);
  });

  it("keys each topic under its own id", () => {
    for (const id of HELP_TOPIC_IDS) {
      expect(helpTopics[id].id).toBe(id);
    }
  });

  it("gives every topic a non-empty title, summary, and detail", () => {
    for (const topic of Object.values(helpTopics)) {
      expect(topic.title.length).toBeGreaterThan(0);
      expect(topic.summary.length).toBeGreaterThan(0);
      expect(topic.detail.length).toBeGreaterThan(0);
      for (const paragraph of topic.summary) {
        expect(paragraph.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("only ever links to an in-app path", () => {
    for (const topic of Object.values(helpTopics)) {
      if (topic.href !== undefined) {
        expect(topic.href.startsWith("/")).toBe(true);
      }
    }
  });

  it("never has an empty list or field block", () => {
    for (const topic of Object.values(helpTopics)) {
      for (const block of topic.detail) {
        if (block.kind === "ul") expect(block.items.length).toBeGreaterThan(0);
        if (block.kind === "fields") expect(block.items.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("GUIDE_TOPIC_ORDER", () => {
  it("only references real, non-duplicated topic ids", () => {
    const seen = new Set<string>();
    for (const id of GUIDE_TOPIC_ORDER) {
      expect(helpTopics[id]).toBeDefined();
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
  });
});

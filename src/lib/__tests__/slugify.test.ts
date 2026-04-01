import { slugify } from "@/lib/slugify";

describe("slugify", () => {
  it("lowercases the name", () => {
    expect(slugify("Will Rea")).toBe("will-rea");
  });

  it("replaces spaces with hyphens", () => {
    expect(slugify("Dr Will Rea")).toBe("dr-will-rea");
  });

  it("strips title punctuation", () => {
    expect(slugify("Dr. Will Rea")).toBe("dr-will-rea");
  });

  it("collapses multiple hyphens", () => {
    expect(slugify("Prof.  Jane Smith")).toBe("prof-jane-smith");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  Will  ")).toBe("will");
  });

  it("handles already-slugged input", () => {
    expect(slugify("will-rea")).toBe("will-rea");
  });
});

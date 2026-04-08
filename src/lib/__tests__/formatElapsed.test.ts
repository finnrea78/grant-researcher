import { formatElapsed } from "@/lib/formatElapsed";

describe("formatElapsed", () => {
  it("formats 0 seconds as 0:00", () => {
    expect(formatElapsed(0)).toBe("0:00");
  });

  it("formats seconds under a minute", () => {
    expect(formatElapsed(5)).toBe("0:05");
    expect(formatElapsed(59)).toBe("0:59");
  });

  it("formats exactly one minute", () => {
    expect(formatElapsed(60)).toBe("1:00");
  });

  it("formats minutes and seconds", () => {
    expect(formatElapsed(90)).toBe("1:30");
    expect(formatElapsed(125)).toBe("2:05");
  });

  it("formats long durations", () => {
    expect(formatElapsed(600)).toBe("10:00");
    expect(formatElapsed(3661)).toBe("61:01");
  });
});

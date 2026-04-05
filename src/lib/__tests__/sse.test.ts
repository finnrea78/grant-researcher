import { formatSSEEvent } from "@/lib/sse";

describe("formatSSEEvent", () => {
  it("serializes a text event", () => {
    const result = formatSSEEvent({ type: "text", text: "hello world" });
    expect(result).toBe('data: {"type":"text","text":"hello world"}\n\n');
  });

  it("serializes a tool event", () => {
    const result = formatSSEEvent({ type: "tool", name: "read_file" });
    expect(result).toBe('data: {"type":"tool","name":"read_file"}\n\n');
  });

  it("serializes a result event", () => {
    const result = formatSSEEvent({ type: "result", turns: 3, cost: 0.05, duration: 1200 });
    expect(result).toBe('data: {"type":"result","turns":3,"cost":0.05,"duration":1200}\n\n');
  });

  it("serializes an error event", () => {
    const result = formatSSEEvent({ type: "error", message: "something went wrong" });
    expect(result).toBe('data: {"type":"error","message":"something went wrong"}\n\n');
  });

  it("always ends with double newline (SSE spec)", () => {
    const result = formatSSEEvent({ type: "text", text: "x" });
    expect(result.endsWith("\n\n")).toBe(true);
  });

  it("starts with 'data: ' prefix", () => {
    const result = formatSSEEvent({ type: "tool", name: "bash" });
    expect(result.startsWith("data: ")).toBe(true);
  });
});

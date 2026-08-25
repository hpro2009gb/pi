import { describe, expect, it } from "vitest";
import { encodeRpcMessage, RpcFramer } from "../packs/lsp/spawn-lsp.ts";

describe("LSP JSON-RPC framing", () => {
	it("encodes and decodes one request", () => {
		const request = { jsonrpc: "2.0", id: 1, method: "initialize", params: { capabilities: {} } };
		const framed = encodeRpcMessage(request);
		expect(framed.toString("utf8")).toMatch(/^Content-Length: \d+\r\n\r\n\{/);

		const framer = new RpcFramer();
		const messages = framer.push(framed);
		expect(messages).toEqual([request]);
	});

	it("buffers a split header and body", () => {
		const request = { jsonrpc: "2.0", id: 2, method: "shutdown" };
		const framed = encodeRpcMessage(request);
		const framer = new RpcFramer();
		expect(framer.push(framed.subarray(0, 8))).toEqual([]);
		expect(framer.push(framed.subarray(8))).toEqual([request]);
	});
});

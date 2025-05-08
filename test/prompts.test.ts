import { describe, it, expect, vi, beforeEach } from "vitest";
import { MockApp } from "./mocks/obsidian";
import { getPrompts } from "tools/prompts.js";

describe("prompt tools", () => {
	let mockApp: MockApp;

	beforeEach(() => {
		vi.clearAllMocks();
		mockApp = new MockApp();
	});

	describe("getPrompts", () => {
		it("should return an array of prompts", () => {
			const prompts = getPrompts(mockApp, { promptsFolder: "prompts" });
			expect(prompts).toBeDefined();
		});
	});
});

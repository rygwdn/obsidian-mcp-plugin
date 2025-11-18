import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isDirectoryAccessible, getFileFrontmatterPermissions } from "../tools/permissions";
import { MockObsidian, createMockRequest } from "./mock_obsidian";
import { DEFAULT_SETTINGS } from "../settings/types";

describe("Permissions functionality", () => {
	let obsidian: MockObsidian;
	let request: ReturnType<typeof createMockRequest>;

	beforeEach(() => {
		// Setup fake timers and set a fixed date
		vi.useFakeTimers();
		vi.setSystemTime("2025-02-02");

		vi.clearAllMocks();

		// Create MockObsidian
		obsidian = new MockObsidian();
		request = createMockRequest(obsidian, {
			directoryPermissions: {
				rules: [
					{
						path: "blocked-dir",
						allowed: false,
					},
				],
				rootPermission: true,
			},
		});

		// Add test files
		obsidian.setFiles({
			"normal.md": "# Normal file",
			"blocked.md": "---\nmcp_access: false\n---\n# Blocked file",
			"readonly.md": "---\nmcp_readonly: true\n---\n# Read-only file",
			"explicit-allow.md": "---\nmcp_access: true\n---\n# Explicitly allowed file",
			"blocked-dir/file.md": "# File in blocked directory",
			"blocked-dir/explicit-allow.md":
				"---\nmcp_access: true\n---\n# Explicitly allowed file in blocked directory",
			"another-blocked-dir/file.md": "# Another file in blocked directory",
		});
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("getFileFrontmatterPermissions", () => {
		it("should return undefined for files without frontmatter permissions", async () => {
			const file = await obsidian.getFileByPath("normal.md", "read", request);
			const permissions = getFileFrontmatterPermissions(obsidian, file);
			expect(permissions.mcp_access).toBeUndefined();
			expect(permissions.mcp_readonly).toBeUndefined();
		});

		it("should return false for mcp_access when set to false in frontmatter", async () => {
			// Get file directly from mock to bypass permission checks (we're testing frontmatter parsing, not permissions)
			const file = obsidian.markdownFiles.get("blocked.md");
			if (!file) {
				throw new Error("File not found: blocked.md");
			}
			const permissions = getFileFrontmatterPermissions(obsidian, file);
			expect(permissions.mcp_access).toBe(false);
		});

		it("should return true for mcp_readonly when set to true in frontmatter", async () => {
			const file = await obsidian.getFileByPath("readonly.md", "read", request);
			const permissions = getFileFrontmatterPermissions(obsidian, file);
			expect(permissions.mcp_readonly).toBe(true);
		});
	});

	describe("isDirectoryAccessible", () => {
		describe("rules-based permissions", () => {
			it("should apply rules in order with first-match-wins logic", () => {
				const testSettings = {
					...DEFAULT_SETTINGS,
					directoryPermissions: {
						rules: [
							{ path: "normal-dir", allowed: true },
							{ path: "high-priority-dir/exception", allowed: true },
							{ path: "high-priority-dir", allowed: false },
						],
						rootPermission: true,
					},
				};

				// First rule takes precedence
				expect(isDirectoryAccessible("high-priority-dir", testSettings)).toBe(false);

				// First matching rule (2nd rule) takes precedence
				expect(isDirectoryAccessible("high-priority-dir/exception", testSettings)).toBe(true);

				// Later rule still applies when it's the first match
				expect(isDirectoryAccessible("normal-dir", testSettings)).toBe(true);
			});

			it("should match parent/child relationships correctly", () => {
				const testSettings = {
					...DEFAULT_SETTINGS,
					directoryPermissions: {
						rules: [
							{ path: "parent/child/grandchild", allowed: false },
							{ path: "parent/child", allowed: true },
							{ path: "parent", allowed: false },
						],
						rootPermission: true,
					},
				};

				expect(isDirectoryAccessible("parent", testSettings)).toBe(false);
				expect(isDirectoryAccessible("parent/child", testSettings)).toBe(true);
				expect(isDirectoryAccessible("parent/child/grandchild", testSettings)).toBe(false);
				expect(isDirectoryAccessible("parent/child/other", testSettings)).toBe(true);
				expect(isDirectoryAccessible("parent/other", testSettings)).toBe(false);
			});

			it("should use rootPermission when no rules match", () => {
				// Blocklist mode (default: allow)
				const blocklistSettings = {
					...DEFAULT_SETTINGS,
					directoryPermissions: {
						rules: [{ path: "private", allowed: false }],
						rootPermission: true, // Allow by default
					},
				};

				expect(isDirectoryAccessible("private", blocklistSettings)).toBe(false);
				expect(isDirectoryAccessible("public", blocklistSettings)).toBe(true);

				// Allowlist mode (default: deny)
				const allowlistSettings = {
					...DEFAULT_SETTINGS,
					directoryPermissions: {
						rules: [{ path: "public", allowed: true }],
						rootPermission: false, // Deny by default
					},
				};

				expect(isDirectoryAccessible("public", allowlistSettings)).toBe(true);
				expect(isDirectoryAccessible("private", allowlistSettings)).toBe(false);
			});

			it("should respect rootPermission setting", () => {
				// Block by default
				const rootBlockedSettings = {
					...DEFAULT_SETTINGS,
					directoryPermissions: {
						rules: [{ path: "allowed", allowed: true }],
						rootPermission: false,
					},
				};

				expect(isDirectoryAccessible("/", rootBlockedSettings)).toBe(false);
				expect(isDirectoryAccessible("", rootBlockedSettings)).toBe(false);
				expect(isDirectoryAccessible("random", rootBlockedSettings)).toBe(false);
				expect(isDirectoryAccessible("allowed", rootBlockedSettings)).toBe(true);

				const rootAllowedSettings = {
					...DEFAULT_SETTINGS,
					directoryPermissions: {
						rules: [{ path: "blocked", allowed: false }],
						rootPermission: true,
					},
				};

				expect(isDirectoryAccessible("/", rootAllowedSettings)).toBe(true);
				expect(isDirectoryAccessible("", rootAllowedSettings)).toBe(true);
				expect(isDirectoryAccessible("random", rootAllowedSettings)).toBe(true);
				expect(isDirectoryAccessible("blocked", rootAllowedSettings)).toBe(false);
			});

			it("should apply rootPermission recursively to all non-specified paths", () => {
				// Root allowed, everything else allowed by default
				const rootAllowedSettings = {
					...DEFAULT_SETTINGS,
					directoryPermissions: {
						rules: [{ path: "blocked", allowed: false }],
						rootPermission: true,
					},
				};

				expect(isDirectoryAccessible("any/path/not/specified", rootAllowedSettings)).toBe(true);
				expect(isDirectoryAccessible("some/random/directory", rootAllowedSettings)).toBe(true);
				expect(isDirectoryAccessible("blocked/subdirectory", rootAllowedSettings)).toBe(false);

				const rootBlockedSettings = {
					...DEFAULT_SETTINGS,
					directoryPermissions: {
						rules: [
							{ path: "also/allowed", allowed: true },
							{ path: "allowed", allowed: true },
						],
						rootPermission: false,
					},
				};

				expect(isDirectoryAccessible("any/path/not/specified", rootBlockedSettings)).toBe(false);
				expect(isDirectoryAccessible("some/random/directory", rootBlockedSettings)).toBe(false);
				expect(isDirectoryAccessible("allowed/subdirectory", rootBlockedSettings)).toBe(true);
				expect(isDirectoryAccessible("also/allowed", rootBlockedSettings)).toBe(true);
				expect(isDirectoryAccessible("also/allowed/nested", rootBlockedSettings)).toBe(true);
			});
		});
	});
});

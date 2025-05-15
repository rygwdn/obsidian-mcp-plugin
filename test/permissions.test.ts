import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	isFileAccessible,
	isFileModifiable,
	isDirectoryAccessible,
	getFileFrontmatterPermissions,
} from "../tools/permissions";
import { MockApp } from "./mocks/obsidian";

describe("Permissions functionality", () => {
	let mockApp: MockApp;

	beforeEach(() => {
		// Setup fake timers and set a fixed date
		vi.useFakeTimers();
		vi.setSystemTime("2025-02-02");

		vi.clearAllMocks();
		mockApp = new MockApp();

		// Setup test files with different permissions
		mockApp.setFiles({
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
		it("should return undefined for files without frontmatter permissions", () => {
			const file = mockApp.vault.getFileByPath("normal.md")!;
			const permissions = getFileFrontmatterPermissions(mockApp, file);
			expect(permissions.mcp_access).toBeUndefined();
			expect(permissions.mcp_readonly).toBeUndefined();
		});

		it("should return false for mcp_access when set to false in frontmatter", () => {
			const file = mockApp.vault.getFileByPath("blocked.md")!;
			const permissions = getFileFrontmatterPermissions(mockApp, file);
			expect(permissions.mcp_access).toBe(false);
		});

		it("should return true for mcp_readonly when set to true in frontmatter", () => {
			const file = mockApp.vault.getFileByPath("readonly.md")!;
			const permissions = getFileFrontmatterPermissions(mockApp, file);
			expect(permissions.mcp_readonly).toBe(true);
		});
	});

	describe("isFileAccessible", () => {
		it("should allow access to normal files", () => {
			const file = mockApp.vault.getFileByPath("normal.md")!;
			expect(isFileAccessible(mockApp, file, mockApp.settings)).toBe(true);
		});

		it("should deny access to files with mcp_access: false", () => {
			const file = mockApp.vault.getFileByPath("blocked.md")!;
			expect(isFileAccessible(mockApp, file, mockApp.settings)).toBe(false);
		});

		it("should allow access to read-only files", () => {
			const file = mockApp.vault.getFileByPath("readonly.md")!;
			expect(isFileAccessible(mockApp, file, mockApp.settings)).toBe(true);
		});

		it("should deny access to files in blocked directories", () => {
			const file = mockApp.vault.getFileByPath("blocked-dir/file.md")!;
			expect(isFileAccessible(mockApp, file, mockApp.settings)).toBe(false);
		});

		it("should allow access to explicitly allowed files even in blocked directories", () => {
			const file = mockApp.vault.getFileByPath("blocked-dir/explicit-allow.md")!;
			expect(isFileAccessible(mockApp, file, mockApp.settings)).toBe(true);
		});
	});

	describe("isFileModifiable", () => {
		it("should allow modification of normal files", () => {
			const file = mockApp.vault.getFileByPath("normal.md")!;
			expect(isFileModifiable(mockApp, file, mockApp.settings)).toBe(true);
		});

		it("should deny modification of read-only files", () => {
			const file = mockApp.vault.getFileByPath("readonly.md")!;
			expect(isFileModifiable(mockApp, file, mockApp.settings)).toBe(false);
		});

		it("should deny modification of blocked files", () => {
			const file = mockApp.vault.getFileByPath("blocked.md")!;
			expect(isFileModifiable(mockApp, file, mockApp.settings)).toBe(false);
		});

		it("should deny modification of files in blocked directories", () => {
			const file = mockApp.vault.getFileByPath("blocked-dir/file.md")!;
			expect(isFileModifiable(mockApp, file, mockApp.settings)).toBe(false);
		});

		it("should allow modification of explicitly allowed files in blocked directories", () => {
			const file = mockApp.vault.getFileByPath("blocked-dir/explicit-allow.md")!;
			expect(isFileModifiable(mockApp, file, mockApp.settings)).toBe(true);
		});
	});

	describe("isDirectoryAccessible", () => {
		describe("rules-based permissions", () => {
			it("should apply rules in order with first-match-wins logic", () => {
				const appWithRules = new MockApp({
					directoryPermissions: {
						rules: [
							{ path: "normal-dir", allowed: true },
							{ path: "high-priority-dir/exception", allowed: true },
							{ path: "high-priority-dir", allowed: false },
						],
						rootPermission: true,
					},
				});

				// First rule takes precedence
				expect(isDirectoryAccessible("high-priority-dir", appWithRules.settings)).toBe(false);

				// First matching rule (2nd rule) takes precedence
				expect(isDirectoryAccessible("high-priority-dir/exception", appWithRules.settings)).toBe(
					true
				);

				// Later rule still applies when it's the first match
				expect(isDirectoryAccessible("normal-dir", appWithRules.settings)).toBe(true);
			});

			it("should match parent/child relationships correctly", () => {
				const appWithRules = new MockApp({
					directoryPermissions: {
						rules: [
							{ path: "parent/child/grandchild", allowed: false },
							{ path: "parent/child", allowed: true },
							{ path: "parent", allowed: false },
						],
						rootPermission: true,
					},
				});

				expect(isDirectoryAccessible("parent", appWithRules.settings)).toBe(false);
				expect(isDirectoryAccessible("parent/child", appWithRules.settings)).toBe(true);
				expect(isDirectoryAccessible("parent/child/grandchild", appWithRules.settings)).toBe(false);
				expect(isDirectoryAccessible("parent/child/other", appWithRules.settings)).toBe(true);
				expect(isDirectoryAccessible("parent/other", appWithRules.settings)).toBe(false);
			});

			it("should use rootPermission when no rules match", () => {
				// Blocklist mode (default: allow)
				const blocklistApp = new MockApp({
					directoryPermissions: {
						rules: [{ path: "private", allowed: false }],
						rootPermission: true, // Allow by default
					},
				});

				expect(isDirectoryAccessible("private", blocklistApp.settings)).toBe(false);
				expect(isDirectoryAccessible("public", blocklistApp.settings)).toBe(true);

				// Allowlist mode (default: deny)
				const allowlistApp = new MockApp({
					directoryPermissions: {
						rules: [{ path: "public", allowed: true }],
						rootPermission: false, // Deny by default
					},
				});

				expect(isDirectoryAccessible("public", allowlistApp.settings)).toBe(true);
				expect(isDirectoryAccessible("private", allowlistApp.settings)).toBe(false);
			});

			it("should respect rootPermission setting", () => {
				// Block by default
				const rootBlockedApp = new MockApp({
					directoryPermissions: {
						rules: [{ path: "allowed", allowed: true }],
						rootPermission: false,
					},
				});

				expect(isDirectoryAccessible("/", rootBlockedApp.settings)).toBe(false);
				expect(isDirectoryAccessible("", rootBlockedApp.settings)).toBe(false);
				expect(isDirectoryAccessible("random", rootBlockedApp.settings)).toBe(false);
				expect(isDirectoryAccessible("allowed", rootBlockedApp.settings)).toBe(true);

				const rootAllowedApp = new MockApp({
					directoryPermissions: {
						rules: [{ path: "blocked", allowed: false }],
						rootPermission: true,
					},
				});

				expect(isDirectoryAccessible("/", rootAllowedApp.settings)).toBe(true);
				expect(isDirectoryAccessible("", rootAllowedApp.settings)).toBe(true);
				expect(isDirectoryAccessible("random", rootAllowedApp.settings)).toBe(true);
				expect(isDirectoryAccessible("blocked", rootAllowedApp.settings)).toBe(false);
			});

			it("should apply rootPermission recursively to all non-specified paths", () => {
				// Root allowed, everything else allowed by default
				const rootAllowedApp = new MockApp({
					directoryPermissions: {
						rules: [{ path: "blocked", allowed: false }],
						rootPermission: true,
					},
				});

				expect(isDirectoryAccessible("any/path/not/specified", rootAllowedApp.settings)).toBe(true);
				expect(isDirectoryAccessible("some/random/directory", rootAllowedApp.settings)).toBe(true);
				expect(isDirectoryAccessible("blocked/subdirectory", rootAllowedApp.settings)).toBe(false);

				const rootBlockedApp = new MockApp({
					directoryPermissions: {
						rules: [
							{ path: "also/allowed", allowed: true },
							{ path: "allowed", allowed: true },
						],
						rootPermission: false,
					},
				});

				expect(isDirectoryAccessible("any/path/not/specified", rootBlockedApp.settings)).toBe(
					false
				);
				expect(isDirectoryAccessible("some/random/directory", rootBlockedApp.settings)).toBe(false);
				expect(isDirectoryAccessible("allowed/subdirectory", rootBlockedApp.settings)).toBe(true);
				expect(isDirectoryAccessible("also/allowed", rootBlockedApp.settings)).toBe(true);
				expect(isDirectoryAccessible("also/allowed/nested", rootBlockedApp.settings)).toBe(true);
			});
		});
	});
});

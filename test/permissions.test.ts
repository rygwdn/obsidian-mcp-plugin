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
		mockApp = new MockApp({
			directoryPermissions: {
				mode: "blocklist",
				directories: ["blocked-dir", "another-blocked-dir"],
			},
		});

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
		it("should allow access to normal directories in blocklist mode", () => {
			expect(isDirectoryAccessible("normal-dir", mockApp.settings)).toBe(true);
		});

		it("should deny access to blocked directories in blocklist mode", () => {
			expect(isDirectoryAccessible("blocked-dir", mockApp.settings)).toBe(false);
		});

		it("should deny access to subdirectories of blocked directories", () => {
			expect(isDirectoryAccessible("blocked-dir/subdir", mockApp.settings)).toBe(false);
		});

		it("should handle root directory correctly", () => {
			expect(isDirectoryAccessible("/", mockApp.settings)).toBe(true);
		});

		it("should handle empty directory path correctly", () => {
			expect(isDirectoryAccessible("", mockApp.settings)).toBe(true);
		});

		it("should deny access to normal directories in allowlist mode", () => {
			// Create a new mockApp instance with allowlist settings
			const allowlistApp = new MockApp({
				directoryPermissions: { mode: "allowlist", directories: ["allowed-dir"] },
			});
			expect(isDirectoryAccessible("normal-dir", allowlistApp.settings)).toBe(false);
		});

		it("should allow access to allowed directories in allowlist mode", () => {
			// Create a new mockApp instance with allowlist settings
			const allowlistApp = new MockApp({
				directoryPermissions: { mode: "allowlist", directories: ["allowed-dir"] },
			});
			expect(isDirectoryAccessible("allowed-dir", allowlistApp.settings)).toBe(true);
		});

		it("should allow access to subdirectories of allowed directories in allowlist mode", () => {
			// Create a new mockApp instance with allowlist settings
			const allowlistApp = new MockApp({
				directoryPermissions: { mode: "allowlist", directories: ["allowed-dir"] },
			});
			expect(isDirectoryAccessible("allowed-dir/subdir", allowlistApp.settings)).toBe(true);
		});
	});
});

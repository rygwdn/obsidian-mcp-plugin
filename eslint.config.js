import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default [
	js.configs.recommended,
	...tseslint.configs.recommended,
	prettierConfig,
	{
		ignores: ["node_modules/**", ".git/**", "main.js", "*.js", "dist/**"],
		languageOptions: {
			ecmaVersion: 2020,
			sourceType: "module",
		},
		files: ["**/*.ts"],
		rules: {
			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": [
				"error",
				{ argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
			],
			"@typescript-eslint/ban-ts-comment": "off",
			"no-prototype-builtins": "off",
			"@typescript-eslint/no-empty-function": "warn",
			"@typescript-eslint/no-explicit-any": "error", // Make it an error in main codebase
		},
	},
	{
		files: ["**/*.ts"],
		ignores: ["tools/permissions.ts"],
		rules: {
			"no-restricted-properties": [
				"error",
				{
					object: "app.vault",
					property: "getFileByPath",
					message:
						"Direct vault access not allowed! Use getAccessibleFile() from permissions.ts instead.",
				},
				{
					object: "this.app.vault",
					property: "getFileByPath",
					message:
						"Direct vault access not allowed! Use getAccessibleFile() from permissions.ts instead.",
				},
				{
					object: "app.vault",
					property: "getMarkdownFiles",
					message:
						"Direct vault access not allowed! Use getAccessibleMarkdownFiles() from permissions.ts instead.",
				},
				{
					object: "this.app.vault",
					property: "getMarkdownFiles",
					message:
						"Direct vault access not allowed! Use getAccessibleMarkdownFiles() from permissions.ts instead.",
				},
				{
					object: "app.vault",
					property: "getFiles",
					message:
						"Direct vault access not allowed! Use getAccessibleFiles() from permissions.ts instead.",
				},
				{
					object: "this.app.vault",
					property: "getFiles",
					message:
						"Direct vault access not allowed! Use getAccessibleFiles() from permissions.ts instead.",
				},
				{
					object: "app.vault",
					property: "create",
					message:
						"Direct vault access not allowed! Use getAccessibleFile() with 'create' permission from permissions.ts instead.",
				},
				{
					object: "this.app.vault",
					property: "create",
					message:
						"Direct vault access not allowed! Use getAccessibleFile() with 'create' permission from permissions.ts instead.",
				},
				{
					object: "app.vault",
					property: "modify",
					message:
						"Direct vault access not allowed! Use getAccessibleFile() with 'write' permission before modifying files.",
				},
				{
					object: "this.app.vault",
					property: "modify",
					message:
						"Direct vault access not allowed! Use getAccessibleFile() with 'write' permission before modifying files.",
				},
				{
					object: "app.vault",
					property: "read",
					message:
						"Direct vault access not allowed! Use getAccessibleFile() with 'read' permission before reading files.",
				},
				{
					object: "this.app.vault",
					property: "read",
					message:
						"Direct vault access not allowed! Use getAccessibleFile() with 'read' permission before reading files.",
				},
				{
					object: "app.vault",
					property: "cachedRead",
					message:
						"Direct vault access not allowed! Use getAccessibleFile() with 'read' permission before reading files.",
				},
				{
					object: "this.app.vault",
					property: "cachedRead",
					message:
						"Direct vault access not allowed! Use getAccessibleFile() with 'read' permission before reading files.",
				},
				{
					object: "app.vault",
					property: "append",
					message:
						"Direct vault access not allowed! Use getAccessibleFile() with 'write' permission before appending to files.",
				},
				{
					object: "this.app.vault",
					property: "append",
					message:
						"Direct vault access not allowed! Use getAccessibleFile() with 'write' permission before appending to files.",
				},
				{
					object: "app.vault",
					property: "delete",
					message:
						"Direct vault access not allowed! Use getAccessibleFile() with 'write' permission before deleting files.",
				},
				{
					object: "this.app.vault",
					property: "delete",
					message:
						"Direct vault access not allowed! Use getAccessibleFile() with 'write' permission before deleting files.",
				},
			],
		},
	},
	{
		files: ["test/**/*.ts"],
		rules: {
			"@typescript-eslint/no-explicit-any": "off", // Disable in test files
		},
	},
];

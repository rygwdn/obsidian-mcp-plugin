import globals from "globals";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

import { defineConfig } from "eslint/config";

export default defineConfig([
	{ ignores: ["node_modules/**", ".git/**", "*.js", "**/*.js"] },
	{ files: ["**/*.mjs"], languageOptions: { globals: globals.node } },
	tseslint.configs.recommended,
	prettierConfig,
	{
		ignores: ["node_modules/**", ".git/**", "main.js", "*.js", "dist/**"],
		files: ["**/*.ts"],
		languageOptions: {
			ecmaVersion: 2020,
			sourceType: "module",
		},
		rules: {
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],
			"@typescript-eslint/ban-ts-comment": "off",
			"@typescript-eslint/no-empty-function": "warn",
			"@typescript-eslint/no-explicit-any": "error", // Make it an error in main codebase
		},
	},
	{
		files: ["**/*.ts"],
		ignores: [
			"obsidian/obsidian_impl.ts",
			"obsidian/obsidian_types.ts",
			"main.ts",
			"test/**/*.ts",
			"settings/**/*.ts",
		],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					paths: [
						{
							name: "obsidian",
							message:
								"Direct import from 'obsidian' is not allowed. Use obsidian_interface.ts instead.",
						},
					],
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
]);

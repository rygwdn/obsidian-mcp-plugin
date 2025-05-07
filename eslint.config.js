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
			"@typescript-eslint/no-explicit-any": "warn", // Downgrade from error to warning
		},
	},
];

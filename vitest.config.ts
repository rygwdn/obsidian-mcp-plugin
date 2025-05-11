import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
	test: {
		environment: "node",
		include: ["**/*.test.ts"],
		silent: "passed-only",
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
			exclude: ["node_modules/", ".github/", "test/"],
		},
	},
	resolve: {
		alias: {
			obsidian: resolve(__dirname, "./test/mocks/obsidian.ts"),
			"obsidian-dataview": resolve(__dirname, "./test/mocks/obsidian-dataview.ts"),
		},
	},
});

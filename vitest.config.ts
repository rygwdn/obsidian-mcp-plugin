import { defineConfig } from "vitest/config";

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
});

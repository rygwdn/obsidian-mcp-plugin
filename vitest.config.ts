import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
	resolve: {
		alias: {
			"settings/types": resolve(__dirname, "./settings/types.ts"),
			"server/auth": resolve(__dirname, "./server/auth.ts"),
		},
	},
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

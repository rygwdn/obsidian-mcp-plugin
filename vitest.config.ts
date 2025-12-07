import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [tsconfigPaths()],
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

/**
 * Global teardown for Playwright e2e tests
 * Called after all tests complete
 */
export default async function globalTeardown() {
	console.log("Running global teardown for e2e tests...");
	// Any cleanup needed after all tests run
	console.log("Global teardown complete.");
}

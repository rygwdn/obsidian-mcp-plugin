import { App } from "obsidian";

export interface LocalRestApiSettings {
	port: number;
	authToken: string;
	bindingHost: string;
	secureServerEnabled: boolean;
}

export function getLocalRestApiSettings(app: App): LocalRestApiSettings | null {
	if (!app.plugins.enabledPlugins.has("obsidian-local-rest-api")) {
		console.error("Local REST API plugin is not enabled");
		return null;
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const localRestApiPlugin = app.plugins.plugins["obsidian-local-rest-api"] as any;
	if (!localRestApiPlugin) {
		console.error("Local REST API plugin instance not found");
		return null;
	}

	if (localRestApiPlugin.settings) {
		return {
			port: localRestApiPlugin.settings.port as number,
			authToken: localRestApiPlugin.settings.apiKey as string,
			bindingHost: (localRestApiPlugin.settings.bindingHost ?? "127.0.0.1") as string,
			secureServerEnabled: localRestApiPlugin.settings.enableSecureServer ?? false,
		};
	}

	return null;
}

declare global {
	interface Window {
		moment: moment.Moment;
	}
}

declare module "obsidian" {
	interface App {
		plugins: {
			enabledPlugins: Set<string>;
			plugins: Record<string, unknown>;
		};
	}
}

export interface DailyNotesPluginSettings {
	format: string;
	folder: string;
	template?: string;
}

export interface DailyNotesPlugin {
	instance: {
		options: DailyNotesPluginSettings;
	};
	enabled: boolean;
}

export interface PeriodicNotesSettings {
	daily?: {
		format?: string;
		folder?: string;
		template?: string;
	};
}

export interface PeriodicNotesPlugin {
	settings: PeriodicNotesSettings;
}

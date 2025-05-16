export type TFile = import("obsidian").TFile;
export type CachedMetadata = import("obsidian").CachedMetadata;

declare global {
	interface Window {
		moment: moment.Moment;
	}
}

declare module "obsidian" {
	interface App {
		plugins: {
			enabledPlugins: Set<string>;
			plugins: Record<string, object | undefined>;
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

import { App, normalizePath } from "obsidian";
import { DailyNotesPlugin, PeriodicNotesPlugin } from "./obsidian_types";

export const ALIASES = {
	today: () => window.moment(),
	yesterday: () => window.moment().subtract(1, "day"),
	tomorrow: () => window.moment().add(1, "day"),
};

export function isDailyNotesEnabled(app: App): boolean {
	return !!(getDailyNotesPlugin(app) || getPeriodicNotesPlugin(app));
}

export async function resolvePath(app: App, uri: URL): Promise<string> {
	let path = uri.pathname;
	if (uri.host) {
		// Handle file://path and file:///path urls - they're easy to confuse
		path = `${uri.host}/${path}`;
	}
	path = path.replace(/^\/|\/$/g, "");

	if (uri.protocol.startsWith("daily")) {
		assertDailyNotePluginEnabled(app);
		const date = parseDate(path, app);
		path = getDailyNotePath(app, date);
	}

	return normalizePath(path);
}

function parseDate(dateStr: string, app: App): moment.Moment {
	if (Object.keys(ALIASES).includes(dateStr)) {
		return ALIASES[dateStr as keyof typeof ALIASES]();
	} else {
		const { format } = getDailyNoteSettings(app);
		return window.moment(dateStr, format);
	}
}

export function assertDailyNotePluginEnabled(app: App): void {
	if (!isDailyNotesEnabled(app)) {
		throw new Error(
			"Cannot access daily notes: No daily notes plugin is enabled (requires either core daily-notes or community periodic-notes plugins)"
		);
	}
}

function getDailyNotePath(app: App, date: moment.Moment): string {
	const { format, folder } = getDailyNoteSettings(app);

	const filename = date.format(format);
	const folderPath = folder ? `${folder}/` : "";
	return `${folderPath}${filename}.md`;
}

function getDailyNotesPlugin(app: App): DailyNotesPlugin | null {
	const internalPlugins = (
		app as unknown as { internalPlugins: { plugins: Record<string, unknown> } }
	).internalPlugins;
	const plugin = internalPlugins.plugins["daily-notes"] as DailyNotesPlugin | undefined;
	return plugin?.enabled ? plugin : null;
}

function getPeriodicNotesPlugin(app: App): PeriodicNotesPlugin | null {
	return app.plugins.plugins["periodic-notes"] as PeriodicNotesPlugin | null;
}

function getDailyNoteSettings(app: App): { format: string; folder: string } {
	const dailyNotesPlugin = getDailyNotesPlugin(app);
	const periodicNotesPlugin = getPeriodicNotesPlugin(app);

	let format: string = "YYYY-MM-DD";
	let folder: string = "";

	if (dailyNotesPlugin) {
		const settings = dailyNotesPlugin.instance.options;
		format = settings.format || format;
		folder = settings.folder || folder;
	} else if (periodicNotesPlugin) {
		const settings = periodicNotesPlugin.settings?.daily;
		format = settings?.format || format;
		folder = settings?.folder || folder;
	}

	return { format, folder };
}

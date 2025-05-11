import { App, TFile, normalizePath } from "obsidian";
import { DailyNotesPlugin, PeriodicNotesPlugin } from "./obsidian_types";
import { logger } from "./logging";

/**
 * Daily note URI scheme prefix
 */
export const URI_PREFIX = "daily://";

/**
 * Result of resolving a daily note path
 */
export interface ResolvedPath {
	/** Actual file system path to the note */
	path: string;
	/** Date string from the daily:// URI */
	dateStr: string;
	/** Whether the path was a daily note path */
	isDailyNote: boolean;
	/** Whether the file exists */
	exists: boolean;
	/** The TFile object if it exists, null otherwise */
	file: TFile | null;
}

/**
 * Check if daily notes functionality is enabled through either the core Daily Notes plugin
 * or the community Periodic Notes plugin
 */
export function isDailyNotesEnabled(app: App): boolean {
	return !!(getDailyNotesPlugin(app) || getPeriodicNotesPlugin(app));
}

/**
 * Get the Daily Notes plugin if it's enabled
 */
export function getDailyNotesPlugin(app: App): DailyNotesPlugin | null {
	// Cast to unknown first, then to the specific type to avoid direct any usage
	const internalPlugins = (
		app as unknown as { internalPlugins: { plugins: Record<string, unknown> } }
	).internalPlugins;
	const plugin = internalPlugins.plugins["daily-notes"] as DailyNotesPlugin | undefined;
	return plugin?.enabled ? plugin : null;
}

/**
 * Get the Periodic Notes plugin if it's enabled
 */
export function getPeriodicNotesPlugin(app: App): PeriodicNotesPlugin | null {
	return app.plugins.plugins["periodic-notes"] as PeriodicNotesPlugin | null;
}

/**
 * Get the settings for daily notes (format and folder)
 */
export function getDailyNoteSettings(app: App): { format: string; folder: string } {
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

/**
 * Parse a date string into a moment object
 * Handles special values like "today", "yesterday", "tomorrow"
 */
export function parseDate(dateStr: string, app: App): moment.Moment {
	if (dateStr === "today") {
		return window.moment();
	} else if (dateStr === "yesterday") {
		return window.moment().subtract(1, "day");
	} else if (dateStr === "tomorrow") {
		return window.moment().add(1, "day");
	} else {
		const { format } = getDailyNoteSettings(app);
		return window.moment(dateStr, format);
	}
}

/**
 * Get the file path for a daily note
 */
export function getDailyNotePath(app: App, date: moment.Moment): string {
	const { format, folder } = getDailyNoteSettings(app);

	const filename = date.format(format);
	const folderPath = folder ? `${folder}/` : "";
	return `${folderPath}${filename}.md`;
}

/**
 * Get a daily note file, optionally creating it if it doesn't exist
 */
export async function getDailyNoteFile(
	app: App,
	dateStr: string,
	create = false
): Promise<TFile | null> {
	if (!isDailyNotesEnabled(app)) {
		throw new Error(
			"No daily notes plugin is enabled (requires either core daily-notes or community periodic-notes plugins)"
		);
	}

	const date = parseDate(dateStr, app);
	const fullPath = getDailyNotePath(app, date);
	let file = app.vault.getFileByPath(fullPath) as TFile | null;

	if (!file && create) {
		file = await createDailyNote(app, fullPath, date);
	}

	return file;
}

/**
 * Create a daily note if it doesn't exist
 */
export async function createDailyNote(
	app: App,
	fullPath: string,
	_date: moment.Moment
): Promise<TFile> {
	const { folder } = getDailyNoteSettings(app);

	if (folder && !(await app.vault.adapter.exists(folder))) {
		await app.vault.createFolder(folder);
	}

	try {
		await app.vault.create(fullPath, "");
		const dailyNote = app.vault.getFileByPath(fullPath);
		if (!dailyNote) {
			throw new Error(`Failed to get daily note after creation: ${fullPath}`);
		}
		logger.log(`Created daily note: ${fullPath}`);
		return dailyNote as TFile;
	} catch (error) {
		throw new Error(
			`Failed to create daily note: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/**
 * Check if a path is a daily note path in the format "daily://date" or "daily://today"
 */
export function isDailyNotePath(path: string): boolean {
	return path.startsWith(URI_PREFIX);
}

/**
 * Extract the date part from a daily note path
 */
export function extractDateFromPath(path: string): string {
	if (!isDailyNotePath(path)) {
		throw new Error(`Not a daily note path: ${path}`);
	}

	return path.substring(URI_PREFIX.length);
}

/**
 * List all available daily note special references
 */
export function getAvailableDailyPaths(): string[] {
	return [`${URI_PREFIX}today`, `${URI_PREFIX}yesterday`, `${URI_PREFIX}tomorrow`];
}

/**
 * Resolve a path which may be a daily:// path or a regular file path
 * Return an object with the resolved path, whether it's a daily note, and if the file exists
 */
export async function resolvePath(
	app: App,
	path: string,
	options: {
		create?: boolean;
		errorOnMissingDailyNotePlugin?: boolean;
	} = {}
): Promise<ResolvedPath> {
	const { create = false, errorOnMissingDailyNotePlugin = true } = options;

	// Handle daily:// paths
	if (isDailyNotePath(path)) {
		// Check if daily notes plugin is enabled
		if (!isDailyNotesEnabled(app)) {
			if (errorOnMissingDailyNotePlugin) {
				throw new Error(
					"Cannot access daily notes: No daily notes plugin is enabled (requires either core daily-notes or community periodic-notes plugins)"
				);
			}
			// Return a placeholder result if we don't want to error
			return {
				path: "",
				dateStr: "",
				isDailyNote: true,
				exists: false,
				file: null,
			};
		}

		const dateStr = extractDateFromPath(path);
		const file = await getDailyNoteFile(app, dateStr, create);
		const exists = !!file;

		return {
			path: file ? file.path : getDailyNotePath(app, parseDate(dateStr, app)),
			dateStr,
			isDailyNote: true,
			exists,
			file,
		};
	}

	// Handle regular file paths
	const normalizedPath = normalizePath(path);
	const file = app.vault.getFileByPath(normalizedPath);

	return {
		path: normalizedPath,
		dateStr: "",
		isDailyNote: false,
		exists: !!file,
		file: file as TFile | null,
	};
}

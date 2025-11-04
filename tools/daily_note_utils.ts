import type { ObsidianInterface } from "../obsidian/obsidian_interface";

export const ALIASES = {
	today: () => window.moment(),
	yesterday: () => window.moment().subtract(1, "day"),
	tomorrow: () => window.moment().add(1, "day"),
};

export async function resolveUriToPath(
	obsidian: ObsidianInterface,
	pathOrUriString: string
): Promise<string> {
	const url = cleanUri(pathOrUriString);

	if (url.host) {
		throw new Error(
			`Unexpected hostname in URI: '${url.host}'. For 'file:' URIs, ensure three slashes (e.g., 'file:///path/to/file'). Input: '${pathOrUriString}'`
		);
	}

	let filePath = decodeURIComponent(url.pathname);
	filePath = filePath.replace(/^\/*|\/*$/g, "");

	if (url.protocol === "daily:") {
		assertDailyNotePluginEnabled(obsidian);
		let dailyIdentifier = filePath;
		if (dailyIdentifier === "" && url.pathname === "/") {
			// Handle daily:/// or daily:/ as today
			dailyIdentifier = "today";
		}
		const date = parseDate(dailyIdentifier, obsidian);
		if (!date.isValid()) {
			throw new Error(
				`Invalid date identifier in daily note URI: '${dailyIdentifier}' (from input '${pathOrUriString}')`
			);
		}
		filePath = getDailyNotePath(obsidian, date);
	}
	return filePath;
}

function parseDate(dateStr: string, obsidian: ObsidianInterface): moment.Moment {
	if (Object.keys(ALIASES).includes(dateStr)) {
		return ALIASES[dateStr as keyof typeof ALIASES]();
	} else {
		const format = obsidian.dailyNotes?.format || "YYYY-MM-DD";
		return window.moment(dateStr, format);
	}
}

export function assertDailyNotePluginEnabled(obsidian: ObsidianInterface): void {
	if (!obsidian.dailyNotes) {
		throw new Error(
			"Cannot access daily notes: No daily notes plugin is enabled (requires either core daily-notes or community periodic-notes plugins)"
		);
	}
}

function getDailyNotePath(obsidian: ObsidianInterface, date: moment.Moment): string {
	const format = obsidian.dailyNotes?.format || "YYYY-MM-DD";
	const folder = obsidian.dailyNotes?.folder || "";

	const filename = date.format(format);
	const folderPath = folder ? `${folder}/` : "";
	return `${folderPath}${filename}.md`;
}

function cleanUri(uri: string) {
	// Normalize common "two-slash" file/daily URIs to "three-slash" to help new URL() parse them correctly.
	// e.g. file://path -> file:///path, daily://today -> daily:///today
	uri = uri.replace(/^(file|daily):\/\/([^/])/, "$1:///$2");

	if (uri.startsWith("daily:")) {
		return new URL(uri);
	}
	if (uri.startsWith("file:")) {
		return new URL(uri);
	}
	if (uri.startsWith("/")) {
		return new URL(`file://${uri}`);
	}
	return new URL(`file:///${uri}`);
}

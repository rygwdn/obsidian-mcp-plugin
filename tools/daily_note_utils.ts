import type { ObsidianInterface } from "../obsidian/obsidian_interface";

export const ALIASES = {
	today: () => window.moment(),
	yesterday: () => window.moment().subtract(1, "day"),
	tomorrow: () => window.moment().add(1, "day"),
};

export async function resolvePath(obsidian: ObsidianInterface, uri: URL): Promise<string> {
	let path = uri.pathname;
	if (uri.host) {
		throw new Error(
			"Unexpected hostname in URL: " +
				uri.host +
				". You probably missed a leading slash in your URI path: " +
				uri.toString()
		);
	}
	path = path.replace(/^\/*|\/*$/g, "");

	if (uri.protocol.startsWith("daily")) {
		assertDailyNotePluginEnabled(obsidian);
		const date = parseDate(path, obsidian);
		if (!date.isValid()) {
			throw new Error("Invalid date: " + path);
		}
		path = getDailyNotePath(obsidian, date);
	}

	return path;
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

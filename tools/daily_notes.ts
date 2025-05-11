import { App, TFile } from "obsidian";
import { z } from "zod";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ReadResourceResult } from "@modelcontextprotocol/sdk/types";
import { ToolRegistration } from "./types";
import { DailyNotesPlugin, PeriodicNotesPlugin } from "./obsidian_types";
import {
	logResourceRegistration,
	withResourceLogging
} from "./logging";

export function getDailyNotesPlugin(app: App): DailyNotesPlugin | null {
	// Cast to unknown first, then to the specific type to avoid direct any usage
	const internalPlugins = (
		app as unknown as { internalPlugins: { plugins: Record<string, unknown> } }
	).internalPlugins;
	const plugin = internalPlugins.plugins["daily-notes"] as DailyNotesPlugin | undefined;
	return plugin?.enabled ? plugin : null;
}

export function getPeriodicNotesPlugin(app: App): PeriodicNotesPlugin | null {
	return app.plugins.plugins["periodic-notes"] as PeriodicNotesPlugin | null;
}

export function isDailyNotesEnabled(app: App): boolean {
	return !!(getDailyNotesPlugin(app) || getPeriodicNotesPlugin(app));
}

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

export function getDailyNotePath(app: App, date: moment.Moment): string {
	const { format, folder } = getDailyNoteSettings(app);

	const filename = date.format(format);
	const folderPath = folder ? `${folder}/` : "";
	return `${folderPath}${filename}.md`;
}

export async function createDailyNote(app: App, fullPath: string, folder: string): Promise<TFile> {
	if (folder && !(await app.vault.adapter.exists(folder))) {
		await app.vault.createFolder(folder);
	}

	try {
		await app.vault.create(fullPath, "");
		const dailyNote = app.vault.getFileByPath(fullPath);
		if (!dailyNote) {
			throw new Error(`Failed to get daily note after creation: ${fullPath}`);
		}
		return dailyNote as TFile;
	} catch (error) {
		throw new Error(
			`Failed to create daily note: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

function getDate(dateStr: string, app: App): moment.Moment {
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

async function getDailyNoteMetadata({
	app,
	dateStr,
	create,
}: {
	app: App;
	dateStr: string;
	create: boolean;
}): Promise<string> {
	if (!isDailyNotesEnabled(app)) {
		throw new Error(
			"No daily notes plugin is enabled (requires either core daily-notes or community periodic-notes plugins)"
		);
	}

	const { folder } = getDailyNoteSettings(app);
	const date = getDate(dateStr, app);

	const fullPath = getDailyNotePath(app, date);

	let dailyNote = app.vault.getFileByPath(fullPath) as TFile | null;
	let wasCreated = false;

	if (!dailyNote && create) {
		dailyNote = await createDailyNote(app, fullPath, folder);
		wasCreated = true;
	}

	if (!dailyNote) {
		return [
			"# Daily Note Not Found",
			`- Date: ${dateStr}`,
			`- Expected Path: \`${fullPath}\``,
			`The daily note for this date does not exist. Use \`create: true\` parameter to create it.`,
		].join("\n");
	}

	return [
		"# Daily Note Information",
		`- Path: \`${dailyNote.path}\``,
		`- Filename: \`${dailyNote.basename}\``,
		`- Created: ${wasCreated ? "Yes (just now)" : "No (already existed)"}`,
		`- Date: ${dateStr}`,
	].join("\n");
}

export const getDailyNoteTool: ToolRegistration = {
	name: "get_daily_note",
	description: "Gets the current daily note or for a specific date",
	annotations: {
		title: "Get Daily Note",
		readOnlyHint: true,
		destructiveHint: false,
		idempotentHint: true,
		openWorldHint: false,
	},
	schema: {
		create: z.boolean().default(false).describe("Create the daily note if it doesn't exist"),
		date: z.string().default("today").describe("Date in YYYY-MM-DD"),
	},
	handler: (app: App) => async (args: { create: boolean; date: string }) => {
		return getDailyNoteMetadata({
			app,
			dateStr: args.date,
			create: args.create,
		});
	},
};

export class DailyNoteResource {
	private resourceName: string;

	constructor(
		private app: App,
		prefix: string = "vault"
	) {
		this.resourceName = `${prefix}-daily-note`;
	}

	public register(server: McpServer) {
		logResourceRegistration(this.resourceName);

		server.resource(
			this.resourceName,
			this.template,
			{ description: "Provides access to daily notes in the Obsidian vault" },
			withResourceLogging(
				this.resourceName,
				async (uri: URL, { date }: { date: string }) => {
					return await this.handler(uri, { date });
				}
			)
		);
	}

	public get template() {
		const uriTemplate = `${this.resourceName}:///{date}`;
		const options = ["today", "yesterday", "tomorrow"];
		return new ResourceTemplate(uriTemplate, {
			list: async () => {
				return {
					resources: options.map((option) => ({
						name: option,
						uri: `${this.resourceName}:///${option}`,
						mimeType: "text/markdown",
					})),
				};
			},
			complete: {
				date: async (value) => {
					return options.filter((option) => option.startsWith(value));
				},
			},
		});
	}

	public async handler(uri: URL, { date }: { date: string }): Promise<ReadResourceResult> {
		return {
			contents: [
				{
					uri: uri.toString(),
					text: await getDailyNoteMetadata({
						app: this.app,
						dateStr: date,
						create: false,
					}),
				},
			],
		};
	}
}

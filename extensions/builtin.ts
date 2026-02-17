import { dataviewExtension } from "./dataview";
import { quickaddExtension } from "./quickadd";
import { tasknotesExtension } from "./tasknotes";
import type { Extension } from "./types";

export const builtinExtensions: Extension[] = [
	dataviewExtension,
	quickaddExtension,
	tasknotesExtension,
];

import { dataviewExtension } from "./dataview";
import { tasknotesExtension } from "./tasknotes";
import type { Extension } from "./types";

export const builtinExtensions: Extension[] = [dataviewExtension, tasknotesExtension];

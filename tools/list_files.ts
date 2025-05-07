import { App, normalizePath } from "obsidian";
import { z } from "zod";
import { ToolRegistration } from "./types";

export const listFilesTool: ToolRegistration = {
  name: "list_files",
  description: "Lists all files and directories in a specific Obsidian directory (relative to vault root)",
  schema: {
    path: z.string().optional().describe("Path to list files from (relative to vault root). Defaults to root.")
  },
  handler: (app: App) => async (args: { path?: string }) => {
    const dirPath = args.path ? normalizePath(args.path) : "";

    const files = [
      ...new Set(
        app.vault
          .getFiles()
          .map((e) => e.path)
          .filter((filename) => filename.startsWith(dirPath))
          .map((filename) => {
            const subPath = filename.slice(dirPath.length);
            if (subPath.indexOf("/") > -1) {
              return subPath.slice(0, subPath.indexOf("/") + 1);
            }
            return subPath;
          })
      ),
    ];
    files.sort();

    if (files.length === 0) {
      throw new Error("No files found in path: " + dirPath);
    }

    return files.join("\n");
  }
};

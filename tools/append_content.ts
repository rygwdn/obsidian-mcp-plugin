import { App, normalizePath, TFile } from "obsidian";
import { z } from "zod";
import { ToolRegistration } from "./types";

export const appendContentTool: ToolRegistration = {
  name: "append_content",
  description: "Appends content to the end of a file (creates the file if it doesn't exist)",
  schema: {
    path: z.string().describe("Path to the file (relative to vault root)"),
    content: z.string().describe("Content to append to the file")
  },
  handler: (app: App) => async (args: { path: string, content: string }) => {
    const filePath = normalizePath(args.path);
    const content = args.content;
    const adapter = app.vault.adapter;

    try {
      await app.vault.createFolder(filePath.substring(0, filePath.lastIndexOf("/")));
    } catch {
      // the folder/file already exists, but we don't care
    }

    let fileContents = "";
    const file = app.vault.getAbstractFileByPath(filePath);
    if (file instanceof TFile) {
      fileContents = await app.vault.read(file);
      if (!fileContents.endsWith("\n")) {
        fileContents += "\n";
      }
    }

    fileContents += content;

    await adapter.write(filePath, fileContents);

    return "Content appended successfully";
  }
};

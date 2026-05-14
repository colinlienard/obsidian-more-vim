import { type Editor, MarkdownView, Plugin, type TFile } from 'obsidian';
import { DEFAULT_SETTINGS, type Settings, SettingTab } from './settings';
import type { EditorView } from '@codemirror/view';
import { defineCommands } from './commands';
import { installSurround } from './surround';
import { Clipboard } from './yank';
import { scrolloff } from './scrolloff';
import { selectWord } from './select-word';
import { multiCursor } from './multi-cursor';
import { Vim } from './vim';

export type ActiveContext = {
	editor: Editor;
	cmView: EditorView;
	file: TFile | null;
};

export default class MoreVim extends Plugin {
	settings = { ...DEFAULT_SETTINGS };
	vim = new Vim();
	clipboard = new Clipboard();

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new SettingTab(this));

		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				if (this.vim.isReady()) return;
				const ctx = this.activeContext();
				if (!ctx || !this.vim.init(ctx.cmView)) return;

				defineCommands(this);

				this.clipboard.install(this);

				this.registerEditorExtension(scrolloff(this));
				this.registerEditorExtension(selectWord(this));
				this.registerEditorExtension(multiCursor(this));
				installSurround(this);
			}),
		);
	}

	onunload() {
		this.clipboard.uninstall(this);
	}

	activeContext(): ActiveContext | undefined {
		const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
		const editor = mdView?.editor;
		if (!editor) return undefined;
		// @ts-expect-error internal - Obsidian's Editor wraps a CodeMirror EditorView
		const cmView = editor.cm as EditorView;
		return { editor, cmView, file: mdView?.file ?? null };
	}

	async loadSettings() {
		const data = (await this.loadData()) as Partial<Settings>;
		this.settings = { ...DEFAULT_SETTINGS, ...data };
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

import { MarkdownView, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, type Settings, SettingTab } from './settings';
import type { EditorView } from '@codemirror/view';
import { defineCommands } from './commands';
import { installSurround } from './surround';
import { Clipboard } from './yank';
import { scrolloff } from './scrolloff';
import { selectWord } from './select-word';
import { multiCursor } from './multi-cursor';
import { Vim } from './vim';

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
				const view = activeEditorView(this);
				if (!view || !this.vim.init(view)) return;

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

	async loadSettings() {
		const data = (await this.loadData()) as Partial<Settings>;
		this.settings = { ...DEFAULT_SETTINGS, ...data };
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

function activeEditorView(plugin: MoreVim): EditorView | undefined {
	const editor = plugin.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
	// @ts-expect-error internal — Obsidian's Editor wraps a CodeMirror EditorView
	return editor?.cm as EditorView | undefined;
}

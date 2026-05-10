import { MarkdownView, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, type Settings, SettingTab } from './settings';
import type { Vim } from '@replit/codemirror-vim';
import { EditorView } from '@codemirror/view';
import { getCM } from '@replit/codemirror-vim';
import { defineCommands } from './commands';
import { setDefaultRegistryAsSystemClipboard } from './yank';

export default class MoreVim extends Plugin {
	settings = DEFAULT_SETTINGS;
	#vim: Vim | undefined;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new SettingTab(this));

		this.app.workspace.on('active-leaf-change', () => {
			if (!this.initVim()) return;

			defineCommands(this);

			setDefaultRegistryAsSystemClipboard(this);
		});
	}

	onunload() {}

	get vim() {
		if (!this.#vim) {
			this.initVim();
		}
		return this.#vim as Vim;
	}

	initVim() {
		const editor = this.getEditor();
		// @ts-expect-error internal
		const view: EditorView | undefined = editor?.cm;
		if (!view) return false;
		const cm = getCM(view);
		// @ts-expect-error internal
		this.#vim = cm?.constructor?.Vim;
		return !!this.#vim;
	}

	getMDView() {
		return this.app.workspace.getActiveViewOfType(MarkdownView);
	}

	getEditor() {
		const mdView = this.getMDView();
		return mdView?.editor;
	}

	getTokenAtCursor() {
		const editor = this.getEditor();
		// @ts-expect-error - internal
		const token = editor.getClickableTokenAt(editor.getCursor());
		return token as { type: 'internal-link' | 'external-link'; text: string } | undefined;
	}

	async loadSettings() {
		const data = (await this.loadData()) as Partial<Settings>;
		this.settings = { ...DEFAULT_SETTINGS, ...data };
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

// Register keys
// this.registerEditorExtension(
// 	Prec.highest(
// 		keymap.of([
// 			{
// 				key: 'Escape',
// 				run(view) {
// 					console.log('escape pressed');
// 					return false;
// 				},
// 			},
// 		]),
// 	),
// );

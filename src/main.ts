import { MarkdownView, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, type Settings, SettingTab } from './settings';
import type { CodeMirror, Vim } from '@replit/codemirror-vim';
import { EditorView } from '@codemirror/view';
import { getCM } from '@replit/codemirror-vim';
import { defineCommands } from './commands';
import { installClipboardRegister, uninstallClipboardRegister } from './yank';
import { scrolloff } from './scrolloff';
import { selectWord } from './select-word';
import { multiCursor } from './multi-cursor';

export default class MoreVim extends Plugin {
	settings = { ...DEFAULT_SETTINGS };
	#vim: Vim | undefined;
	#cm: CodeMirror | undefined;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new SettingTab(this));

		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				if (this.#vim) return;
				if (!this.init()) return;

				defineCommands(this);

				installClipboardRegister(this);

				this.registerEditorExtension(scrolloff(this));
				this.registerEditorExtension(selectWord(this));
				this.registerEditorExtension(multiCursor(this));
			}),
		);
	}

	onunload() {
		uninstallClipboardRegister(this);
	}

	// TODO: remove this
	get vim() {
		if (!this.#vim) {
			this.init();
		}
		return this.#vim as Vim;
	}

	get vimMode() {
		return this.#cm?.state.vim?.mode as 'normal' | 'insert' | 'visual' | 'command';
	}

	// TODO: remove this
	get cm() {
		return this.#cm as CodeMirror;
	}

	init() {
		const editor = this.getEditor();
		// @ts-expect-error internal
		const view: EditorView | undefined = editor?.cm;
		if (!view) return false;
		this.#cm = getCM(view) || undefined;
		// @ts-expect-error internal
		this.#vim = this.#cm?.constructor?.Vim;
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

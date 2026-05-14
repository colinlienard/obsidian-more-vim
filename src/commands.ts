import type { EditorView } from '@codemirror/view';
import { Editor, MarkdownView } from 'obsidian';
import type MoreVim from './main';

export function defineCommands(plugin: MoreVim) {
	plugin.vim.defineCommand({
		name: 'navigateLinkUnderCursor',
		keys: 'gd',
		fn() {
			const mdView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
			if (!mdView?.editor) return;
			const token = getTokenAtCursor(mdView.editor);
			if (token?.type === 'internal-link') {
				void plugin.app.workspace.openLinkText(token.text, mdView.file?.path ?? '');
			}
		},
	});

	plugin.vim.defineCommand({
		name: 'openLinkUnderCursor',
		keys: 'gx',
		fn() {
			const mdView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
			if (!mdView?.editor) return;
			const token = getTokenAtCursor(mdView.editor);
			if (token?.type === 'external-link') {
				window.open(token.text, '_blank');
			}
		},
	});

	plugin.vim.defineCommand({
		name: 'openLineKeepList',
		keys: 'o',
		fn() {
			const editor = plugin.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
			if (!editor) return;
			const { line } = editor.getCursor();
			editor.setCursor({ line, ch: editor.getLine(line).length });
			// @ts-expect-error internal — Obsidian's Editor wraps a CodeMirror EditorView
			const view = editor.cm as EditorView;
			plugin.vim.send(view, 'A'); // insert mode at end of line
			view.contentDOM.dispatchEvent(
				new KeyboardEvent('keydown', {
					key: 'Enter',
					code: 'Enter',
					bubbles: true,
					cancelable: true,
				}),
			);
		},
	});
}

function getTokenAtCursor(editor: Editor) {
	// @ts-expect-error - internal
	const token = editor.getClickableTokenAt(editor.getCursor());
	return token as { type: 'internal-link' | 'external-link'; text: string } | undefined;
}

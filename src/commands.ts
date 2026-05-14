import type { EditorView } from '@codemirror/view';
import { Editor, MarkdownView } from 'obsidian';
import type MoreVim from './main';
import type { CodeMirrorV } from '@replit/codemirror-vim';

export function defineCommands(plugin: MoreVim) {
	const mdView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
	const editor = mdView?.editor;
	if (!mdView || !editor) return;

	defineCommand(plugin, {
		name: 'navigateLinkUnderCursor',
		keys: 'gd',
		fn() {
			const token = getTokenAtCursor(editor);
			if (token?.type === 'internal-link') {
				void plugin.app.workspace.openLinkText(token.text, mdView.file?.path ?? '');
			}
		},
	});

	defineCommand(plugin, {
		name: 'openLinkUnderCursor',
		keys: 'gx',
		fn() {
			const token = getTokenAtCursor(editor);
			if (token?.type === 'external-link') {
				window.open(token.text, '_blank');
			}
		},
	});

	defineCommand(plugin, {
		name: 'openLineKeepList',
		keys: 'o',
		fn(cm) {
			const { line } = editor.getCursor();
			const lineText = editor.getLine(line);
			editor.setCursor({ line, ch: lineText.length });
			plugin.vim?.handleKey(cm, 'A', 'user'); // insert mode at end of line
			// @ts-expect-error internal
			const view = editor.cm as EditorView;
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

function defineCommand(
	plugin: MoreVim,
	{ name, fn, keys }: { name: string; fn: (cm: CodeMirrorV) => void; keys: string },
) {
	plugin.vim?.defineAction(name, fn);
	plugin.vim?.mapCommand(keys, 'action', name, {}, { context: 'normal' });
}

function getTokenAtCursor(editor: Editor) {
	// @ts-expect-error - internal
	const token = editor.getClickableTokenAt(editor.getCursor());
	return token as { type: 'internal-link' | 'external-link'; text: string } | undefined;
}

import { Editor } from 'obsidian';
import type MoreVim from './main';

export function defineCommands(plugin: MoreVim) {
	plugin.vim.defineCommand({
		name: 'navigateLinkUnderCursor',
		keys: 'gd',
		fn() {
			const ctx = plugin.activeContext();
			if (!ctx) return;
			const token = getTokenAtCursor(ctx.editor);
			if (token?.type === 'internal-link') {
				void plugin.app.workspace.openLinkText(token.text, ctx.file?.path ?? '');
			}
		},
	});

	plugin.vim.defineCommand({
		name: 'openLinkUnderCursor',
		keys: 'gx',
		fn() {
			const ctx = plugin.activeContext();
			if (!ctx) return;
			const token = getTokenAtCursor(ctx.editor);
			if (token?.type === 'external-link') {
				window.open(token.text, '_blank');
			}
		},
	});

	plugin.vim.defineCommand({
		name: 'openLineKeepList',
		keys: 'o',
		fn() {
			const ctx = plugin.activeContext();
			if (!ctx) return;
			const { editor, cmView } = ctx;
			const { line } = editor.getCursor();
			editor.setCursor({ line, ch: editor.getLine(line).length });
			plugin.vim.send(cmView, 'A'); // insert mode at end of line
			cmView.contentDOM.dispatchEvent(
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

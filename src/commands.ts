import type MoreVim from './main';

export function defineCommands(plugin: MoreVim) {
	const mdView = plugin.getMDView();
	const editor = plugin.getEditor();
	if (!mdView || !editor) return;

	plugin.vim.defineAction('navigateLinkUnderCursor', () => {
		const token = plugin.getTokenAtCursor();
		if (token?.type === 'internal-link') {
			void plugin.app.workspace.openLinkText(token.text, mdView.file?.path ?? '');
		}
	});

	plugin.vim.defineAction('openLinkUnderCursor', () => {
		const token = plugin.getTokenAtCursor();
		if (token?.type === 'external-link') {
			window.open(token.text, '_blank');
		}
	});

	plugin.vim.mapCommand('gd', 'action', 'navigateLinkUnderCursor', {}, { context: 'normal' });
	plugin.vim.mapCommand('gx', 'action', 'openLinkUnderCursor', {}, { context: 'normal' });
}

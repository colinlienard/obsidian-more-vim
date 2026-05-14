import { EditorSelection, Prec } from '@codemirror/state';
import { keymap, type EditorView } from '@codemirror/view';
import type MoreVim from './main';

const MOTIONS = ['h', 'j', 'k', 'l', 'w', 'W', 'b', 'B', 'e', 'E', '$', '^'];

export function multiCursor(plugin: MoreVim) {
	return Prec.highest(
		keymap.of([
			...MOTIONS.map((key) => ({ key, run: runPerCursor(key, plugin) })),
			{ key: 'Escape', run: collapseToMain(plugin) },
		]),
	);
}

function runPerCursor(key: string, plugin: MoreVim) {
	return (view: EditorView) => {
		if (view.state.selection.ranges.length <= 1) return false;
		if (plugin.vim.mode(view) !== 'normal') return false;

		plugin.vim.perCursor(view, (v) => plugin.vim.send(v, key));
		return true;
	};
}

function collapseToMain(plugin: MoreVim) {
	return (view: EditorView) => {
		const selection = view.state.selection;
		if (selection.ranges.length <= 1) return false;
		if (plugin.vim.mode(view) !== 'normal') return false;

		view.dispatch({ selection: EditorSelection.single(selection.main.head) });
		return true;
	};
}

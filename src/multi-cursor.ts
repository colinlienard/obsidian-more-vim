import { EditorSelection, Prec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import type MoreVim from './main';

const MOTIONS = ['h', 'j', 'k', 'l', 'w', 'W', 'b', 'B', 'e', 'E', '$', '^'];

export function multiCursor(plugin: MoreVim) {
	return Prec.highest(
		keymap.of([
			...MOTIONS.map((key) => ({ key, run: runPerCursor(key, plugin) })),
			{ key: 'Escape', run: collapseToMain(plugin) },
			{ key: 'Mod-Alt-ArrowDown', run: addCursorVertical(true) },
			{ key: 'Mod-Alt-ArrowUp', run: addCursorVertical(false) },
		]),
	);
}

function addCursorVertical(forward: boolean) {
	return (view: EditorView) => {
		const sel = view.state.selection;
		const main = sel.main;
		const moved = view.moveVertically(main, forward);
		if (moved.head === main.head) return true;

		const ranges = [...sel.ranges, moved];
		view.dispatch({
			selection: EditorSelection.create(ranges, ranges.length - 1),
			effects: EditorView.scrollIntoView(moved.head, { y: 'nearest' }),
		});
		return true;
	};
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

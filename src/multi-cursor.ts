import { EditorSelection, Prec, type SelectionRange } from '@codemirror/state';
import { keymap, type EditorView } from '@codemirror/view';
import { getCM } from '@replit/codemirror-vim';
import type MoreVim from './main';

const MOTIONS = ['h', 'j', 'k', 'l', 'w', 'W', 'b', 'B', 'e', 'E', '$', '^'];

export function multiCursor(plugin: MoreVim) {
	return Prec.highest(
		keymap.of([
			...MOTIONS.map((key) => ({ key, run: runPerCursor(key, plugin) })),
			{ key: 'Escape', run: collapseToMain },
		]),
	);
}

function runPerCursor(key: string, plugin: MoreVim) {
	return (view: EditorView) => {
		const selection = view.state.selection;
		if (selection.ranges.length <= 1 || !plugin.cm || plugin.cm.state.vim?.mode !== 'normal')
			return false;

		const oldRanges = selection.ranges;
		const newRanges: SelectionRange[] = [];
		for (const range of oldRanges) {
			view.dispatch({ selection: EditorSelection.single(range.head) });
			plugin.vim?.handleKey(plugin.cm, key, 'user');
			const main = view.state.selection.main;
			newRanges.push(EditorSelection.range(main.anchor, main.head));
		}
		view.dispatch({
			selection: EditorSelection.create(newRanges, newRanges.length - 1),
		});
		return true;
	};
}

function collapseToMain(view: EditorView) {
	const selection = view.state.selection;
	if (selection.ranges.length <= 1) return false;
	const cm = getCM(view);
	if (!cm) return false;
	const mode = cm.state.vim?.mode;
	if (mode !== 'normal') return false;

	view.dispatch({ selection: EditorSelection.single(selection.main.head) });
	return true;
}

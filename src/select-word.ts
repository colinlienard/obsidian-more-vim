import { EditorSelection, Prec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import type MoreVim from './main';

export function selectWord(plugin: MoreVim) {
	return Prec.highest(
		keymap.of([
			{
				key: 'Mod-d',
				run(view: EditorView) {
					if (!plugin.settings.modD || !plugin.vim.isReady()) return false;

					const mode = plugin.vim.mode(view);
					const selection = view.state.selection;
					const main = selection.main;

					if (mode === 'insert' && main.empty && selection.ranges.length === 1) return false;

					if (main.empty && selection.ranges.length === 1) {
						plugin.vim.send(view, 'v');
						plugin.vim.send(view, 'i');
						plugin.vim.send(view, 'w');
						return true;
					}

					const needle = view.state.sliceDoc(main.from, main.to);
					if (!needle) return true;

					const doc = view.state.doc.toString();
					const taken = new Set(selection.ranges.map((r) => r.from));
					let foundAt = findNext(doc, needle, main.to, taken);
					if (foundAt === -1) foundAt = findNext(doc, needle, 0, taken);
					if (foundAt === -1) return true;

					const newRange = EditorSelection.range(foundAt, foundAt + needle.length);
					const ranges = [...selection.ranges, newRange];

					if (mode === 'visual') {
						plugin.vim.send(view, '<Esc>');
					}

					view.dispatch({
						selection: EditorSelection.create(ranges, ranges.length - 1),
						effects: EditorView.scrollIntoView(foundAt + needle.length, { y: 'center' }),
					});

					return true;
				},
			},
		]),
	);
}

function findNext(doc: string, needle: string, from: number, taken: Set<number>) {
	let idx = doc.indexOf(needle, from);
	while (idx !== -1 && taken.has(idx)) {
		idx = doc.indexOf(needle, idx + 1);
	}
	return idx;
}

import { EditorSelection, Prec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { getCM } from '@replit/codemirror-vim';
import type MoreVim from './main';

export function selectWord(plugin: MoreVim) {
	return Prec.highest(
		keymap.of([
			{
				key: 'Mod-d',
				run(view: EditorView) {
					if (!plugin.settings.modD) return false;

					const cm = getCM(view);
					if (!cm) return false;

					const mode = plugin.vimMode;
					const selection = view.state.selection;
					const main = selection.main;

					if (mode === 'insert' && main.empty && selection.ranges.length === 1) return false;

					if (main.empty && selection.ranges.length === 1) {
						plugin.vim.handleKey(cm, 'v', 'user');
						plugin.vim.handleKey(cm, 'i', 'user');
						plugin.vim.handleKey(cm, 'w', 'user');
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

					// Esc here collapses vim's visual selection to a single cursor; the
					// dispatch below restores the full multi-range selection.
					if (mode === 'visual') {
						plugin.vim.handleKey(cm, '<Esc>', 'user');
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

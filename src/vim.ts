import { EditorSelection, type SelectionRange } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { getCM } from '@replit/codemirror-vim';
import type { CodeMirrorV, Vim as VimNamespace } from '@replit/codemirror-vim';

export type VimMode = 'normal' | 'visual' | 'insert' | 'replace';

export class Vim {
	private namespace: VimNamespace | undefined;

	init(view: EditorView): boolean {
		const cm = getCM(view);
		// @ts-expect-error internal — the Vim namespace is hung off cm's constructor
		this.namespace = cm?.constructor?.Vim as VimNamespace | undefined;
		return !!this.namespace;
	}

	isReady(): boolean {
		return !!this.namespace;
	}

	mode(view: EditorView): VimMode | undefined {
		const cm = getCM(view);
		if (!cm) return undefined;
		const raw = cm.state.vim?.mode;
		switch (raw) {
			case 'visual':
			case 'insert':
			case 'replace':
				return raw;
			// @replit/codemirror-vim leaves `mode` unset in plain normal mode, so
			// any unrecognized value (including undefined) folds to 'normal'.
			default:
				return 'normal';
		}
	}

	send(view: EditorView, keys: string): void {
		const cm = getCM(view);
		if (!cm || !this.namespace) return;
		this.namespace.handleKey(cm, keys, 'user');
	}

	defineCommand(opts: {
		name: string;
		keys: string;
		context?: 'normal' | 'visual';
		fn: (cm: CodeMirrorV) => void;
	}): void {
		if (!this.namespace) return;
		this.namespace.defineAction(opts.name, opts.fn);
		this.namespace.mapCommand(
			opts.keys,
			'action',
			opts.name,
			{},
			{ context: opts.context ?? 'normal' },
		);
	}

	getRegisterController(): ReturnType<VimNamespace['getRegisterController']> | undefined {
		return this.namespace?.getRegisterController();
	}

	// Resolve a text-object range (`iw`, `aW`, …) without leaving any trace in
	// vim state: enters visual mode to let vim compute the selection, reads it,
	// then escapes and restores the cursor (vim leaves it at the selection end).
	textObjectRange(
		view: EditorView,
		scope: 'i' | 'a',
		target: string,
	): [number, number] | undefined {
		if (!this.namespace) return undefined;
		const origCursor = view.state.selection.main.head;
		this.send(view, 'v');
		this.send(view, scope);
		this.send(view, target);
		const sel = view.state.selection.main;
		const from = Math.min(sel.anchor, sel.head);
		const to = Math.max(sel.anchor, sel.head);
		this.send(view, '<Esc>');
		view.dispatch({ selection: { anchor: origCursor } });
		if (from === to) return undefined;
		return [from, to];
	}

	// Run `fn` once per selection range, collapsing the editor to that range
	// before each call, then reassemble all resulting selections into a single
	// multi-range selection. Synchronous — relies on vim.handleKey mutating
	// selection in place.
	perCursor(view: EditorView, fn: (view: EditorView) => void): void {
		const oldRanges = view.state.selection.ranges;
		const newRanges: SelectionRange[] = [];
		for (const range of oldRanges) {
			view.dispatch({ selection: EditorSelection.single(range.head) });
			fn(view);
			const main = view.state.selection.main;
			newRanges.push(EditorSelection.range(main.anchor, main.head));
		}
		view.dispatch({ selection: EditorSelection.create(newRanges, newRanges.length - 1) });
	}
}

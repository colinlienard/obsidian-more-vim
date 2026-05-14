import { EditorView } from '@codemirror/view';
import { getCM } from '@replit/codemirror-vim';
import type MoreVim from './main';

type Pair = [string, string];

const PAIRS: Record<string, Pair> = {
	'(': ['( ', ' )'],
	')': ['(', ')'],
	'[': ['[ ', ' ]'],
	']': ['[', ']'],
	'{': ['{ ', ' }'],
	'}': ['{', '}'],
	'<': ['<', '>'],
	'>': ['<', '>'],
	'"': ['"', '"'],
	"'": ["'", "'"],
	'`': ['`', '`'],
	'*': ['*', '*'],
	_: ['_', '_'],
	'~': ['~', '~'],
};

const ALIASES: Record<string, string> = { b: '(', B: '{', r: '[' };
const normalizePair = (k: string) => ALIASES[k] ?? k;
const isPair = (k: string) => Object.prototype.hasOwnProperty.call(PAIRS, normalizePair(k));

type State =
	| { kind: 'idle' }
	| { kind: 'op'; op: 'y' | 'd' | 'c' }
	| { kind: 'ys' }
	| { kind: 'ysi' }
	| { kind: 'ysa' }
	| { kind: 'wrap'; from: number; to: number }
	| { kind: 'ds' }
	| { kind: 'cs' }
	| { kind: 'csOld'; old: string }
	| { kind: 'vS' };

export function installSurround(plugin: MoreVim) {
	let state: State = { kind: 'idle' };

	plugin.registerDomEvent(
		activeDocument,
		'keydown',
		(event) => {
			if (event.metaKey) return;
			// Skip plain Ctrl, but allow AltGr (which browsers report as Ctrl+Alt
			// on Windows) so layouts that need it for brackets/quotes work.
			if (event.ctrlKey && !event.altKey) return;
			if (event.key === 'Escape') {
				state = { kind: 'idle' };
				return;
			}
			if (event.key.length !== 1) return;

			const target = event.target as HTMLElement | null;
			if (!target) return;
			const view = EditorView.findFromDOM(target);
			if (!view) return;

			const cm = getCM(view);
			if (!cm || !plugin.vim) return;

			const rawMode = cm.state.vim?.mode;
			if (rawMode === 'insert' || rawMode === 'replace') return;
			const mode: 'normal' | 'visual' = rawMode === 'visual' ? 'visual' : 'normal';

			const handled = step(plugin, view, cm, event.key, mode, state, (s) => {
				state = s;
			});
			if (handled) {
				event.preventDefault();
				event.stopPropagation();
				event.stopImmediatePropagation();
			}
		},
		{ capture: true },
	);
}

function step(
	plugin: MoreVim,
	view: EditorView,
	cm: ReturnType<typeof getCM>,
	key: string,
	mode: 'normal' | 'visual',
	state: State,
	setState: (s: State) => void,
): boolean {
	if (!cm || !plugin.vim) return false;

	switch (state.kind) {
		case 'idle':
			if (mode === 'normal' && (key === 'y' || key === 'd' || key === 'c')) {
				setState({ kind: 'op', op: key });
				return true;
			}
			if (mode === 'visual' && key === 'S') {
				setState({ kind: 'vS' });
				return true;
			}
			return false;

		case 'op':
			if (key === 's') {
				if (state.op === 'y') setState({ kind: 'ys' });
				else if (state.op === 'd') setState({ kind: 'ds' });
				else setState({ kind: 'cs' });
				return true;
			}
			// Not a surround — replay the original op key + this key back to vim.
			plugin.vim.handleKey(cm, state.op, 'user');
			plugin.vim.handleKey(cm, key, 'user');
			setState({ kind: 'idle' });
			return true;

		case 'ys':
			if (key === 's') {
				// yss<ch>: line range (excluding leading whitespace)
				const pos = view.state.selection.main.head;
				const line = view.state.doc.lineAt(pos);
				const leading = /^\s*/.exec(line.text)?.[0].length ?? 0;
				setState({ kind: 'wrap', from: line.from + leading, to: line.to });
				return true;
			}
			if (key === 'i') {
				setState({ kind: 'ysi' });
				return true;
			}
			if (key === 'a') {
				setState({ kind: 'ysa' });
				return true;
			}
			setState({ kind: 'idle' });
			return true;

		case 'ysi':
		case 'ysa': {
			const aroundOrInner = state.kind === 'ysi' ? 'i' : 'a';
			if (key === 'w' || key === 'W' || isPair(key)) {
				const target = key === 'w' || key === 'W' ? key : normalizePair(key);
				const range = resolveRange(plugin, cm, view, aroundOrInner, target);
				if (!range) {
					setState({ kind: 'idle' });
					return true;
				}
				setState({ kind: 'wrap', from: range[0], to: range[1] });
				return true;
			}
			setState({ kind: 'idle' });
			return true;
		}

		case 'wrap':
			if (isPair(key)) {
				wrapRange(view, state.from, state.to, normalizePair(key));
			}
			setState({ kind: 'idle' });
			return true;

		case 'ds':
			if (isPair(key)) {
				const range = resolveRange(plugin, cm, view, 'a', normalizePair(key));
				if (range && range[1] - range[0] >= 2) {
					const [from, to] = range;
					view.dispatch({
						changes: [
							{ from: to - 1, to, insert: '' },
							{ from, to: from + 1, insert: '' },
						],
						selection: { anchor: from },
					});
				}
			}
			setState({ kind: 'idle' });
			return true;

		case 'cs':
			if (isPair(key)) {
				setState({ kind: 'csOld', old: normalizePair(key) });
			} else {
				setState({ kind: 'idle' });
			}
			return true;

		case 'csOld':
			if (isPair(key)) {
				const range = resolveRange(plugin, cm, view, 'a', state.old);
				if (range && range[1] - range[0] >= 2) {
					const [from, to] = range;
					const [open, close] = PAIRS[normalizePair(key)];
					view.dispatch({
						changes: [
							{ from: to - 1, to, insert: close },
							{ from, to: from + 1, insert: open },
						],
						selection: { anchor: from },
					});
				}
			}
			setState({ kind: 'idle' });
			return true;

		case 'vS':
			if (isPair(key)) {
				const sel = view.state.selection.main;
				const from = Math.min(sel.anchor, sel.head);
				const to = Math.max(sel.anchor, sel.head);
				plugin.vim.handleKey(cm, '<Esc>', 'user');
				if (from !== to) wrapRange(view, from, to, normalizePair(key));
			}
			setState({ kind: 'idle' });
			return true;
	}
}

function resolveRange(
	plugin: MoreVim,
	cm: NonNullable<ReturnType<typeof getCM>>,
	view: EditorView,
	scope: 'i' | 'a',
	target: string,
): [number, number] | undefined {
	// Pair characters: use our own finder so we can match pairs the cursor isn't
	// strictly inside (vim's text-objects require cursor-inside).
	if (Object.prototype.hasOwnProperty.call(PAIRS, target)) {
		return findPairRange(view, target, view.state.selection.main.head, scope);
	}

	// Words/WORDs: delegate to vim's text-objects. Save & restore the cursor
	// because the visual-then-escape dance leaves it at the selection's end.
	if (!plugin.vim) return;
	const origCursor = view.state.selection.main.head;
	plugin.vim.handleKey(cm, 'v', 'user');
	plugin.vim.handleKey(cm, scope, 'user');
	plugin.vim.handleKey(cm, target, 'user');
	const sel = view.state.selection.main;
	const from = Math.min(sel.anchor, sel.head);
	const to = Math.max(sel.anchor, sel.head);
	plugin.vim.handleKey(cm, '<Esc>', 'user');
	view.dispatch({ selection: { anchor: origCursor } });
	if (from === to) return;
	return [from, to];
}

const BRACKETS: Record<string, string> = { '(': ')', '[': ']', '{': '}', '<': '>' };

function findPairRange(
	view: EditorView,
	ch: string,
	cursor: number,
	scope: 'i' | 'a',
): [number, number] | undefined {
	if (Object.prototype.hasOwnProperty.call(BRACKETS, ch)) {
		return findBracketRange(view, ch, BRACKETS[ch], cursor, scope);
	}
	return findQuoteRange(view, ch, cursor, scope);
}

function findBracketRange(
	view: EditorView,
	open: string,
	close: string,
	cursor: number,
	scope: 'i' | 'a',
): [number, number] | undefined {
	const doc = view.state.doc.toString();
	let depth = 0;
	let openPos = -1;
	for (let i = cursor - 1; i >= 0; i--) {
		const c = doc[i];
		if (c === close) depth++;
		else if (c === open) {
			if (depth === 0) {
				openPos = i;
				break;
			}
			depth--;
		}
	}
	if (openPos === -1) {
		// Cursor before any pair — accept the first opener forward.
		for (let i = cursor; i < doc.length; i++) {
			if (doc[i] === open) {
				openPos = i;
				break;
			}
		}
	}
	if (openPos === -1) return;

	depth = 0;
	let closePos = -1;
	for (let i = openPos + 1; i < doc.length; i++) {
		const c = doc[i];
		if (c === open) depth++;
		else if (c === close) {
			if (depth === 0) {
				closePos = i;
				break;
			}
			depth--;
		}
	}
	if (closePos === -1) return;
	return scope === 'i' ? [openPos + 1, closePos] : [openPos, closePos + 1];
}

function findQuoteRange(
	view: EditorView,
	ch: string,
	cursor: number,
	scope: 'i' | 'a',
): [number, number] | undefined {
	const doc = view.state.doc.toString();
	const positions: number[] = [];
	for (let i = 0; i < doc.length; i++) {
		if (doc[i] === ch && (i === 0 || doc[i - 1] !== '\\')) positions.push(i);
	}
	const pairFor = (a: number, b: number): [number, number] =>
		scope === 'i' ? [a + 1, b] : [a, b + 1];

	// Pair surrounding the cursor.
	for (let i = 0; i + 1 < positions.length; i += 2) {
		if (cursor >= positions[i] && cursor <= positions[i + 1]) {
			return pairFor(positions[i], positions[i + 1]);
		}
	}
	// First pair at/after the cursor.
	for (let i = 0; i + 1 < positions.length; i += 2) {
		if (positions[i] >= cursor) return pairFor(positions[i], positions[i + 1]);
	}
	// Otherwise the last pair before the cursor.
	for (let i = positions.length - 2; i >= 0; i -= 2) {
		if (positions[i + 1] <= cursor) return pairFor(positions[i], positions[i + 1]);
	}
	return;
}

function wrapRange(view: EditorView, from: number, to: number, ch: string) {
	const [open, close] = PAIRS[ch];
	view.dispatch({
		changes: [
			{ from: to, to, insert: close },
			{ from, to: from, insert: open },
		],
		selection: { anchor: from },
	});
}

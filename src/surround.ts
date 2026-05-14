import { EditorView } from '@codemirror/view';
import type MoreVim from './main';

type Pair = [string, string];

// Following vim-surround, the "opening" bracket variant pads with inner
// spaces; the "closing" variant doesn't.
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

const BRACKETS: Record<string, string> = { '(': ')', '[': ']', '{': '}', '<': '>' };

export type State =
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

export type Effect =
	| { kind: 'wrap'; from: number; to: number; ch: string }
	| { kind: 'deletePair'; from: number; to: number }
	| { kind: 'changePair'; from: number; to: number; ch: string }
	| { kind: 'replayKeys'; keys: string[] }
	| { kind: 'escapeAndWrap'; from: number; to: number; ch: string };

export type StepResult = {
	next: State;
	handled: boolean;
	effect?: Effect;
};

export type StepDeps = {
	resolveWordObject: (scope: 'i' | 'a', target: 'w' | 'W') => [number, number] | undefined;
};

export const IDLE: State = { kind: 'idle' };

export function step(
	state: State,
	key: string,
	mode: 'normal' | 'visual',
	view: EditorView,
	deps: StepDeps,
): StepResult {
	switch (state.kind) {
		case 'idle':
			if (mode === 'normal' && (key === 'y' || key === 'd' || key === 'c')) {
				return { next: { kind: 'op', op: key }, handled: true };
			}
			if (mode === 'visual' && key === 'S') {
				return { next: { kind: 'vS' }, handled: true };
			}
			return { next: state, handled: false };

		case 'op':
			if (key === 's') {
				if (state.op === 'y') return { next: { kind: 'ys' }, handled: true };
				if (state.op === 'd') return { next: { kind: 'ds' }, handled: true };
				return { next: { kind: 'cs' }, handled: true };
			}
			return {
				next: IDLE,
				handled: true,
				effect: { kind: 'replayKeys', keys: [state.op, key] },
			};

		case 'ys':
			if (key === 's') {
				// yss<ch>: line range (excluding leading whitespace)
				const pos = view.state.selection.main.head;
				const line = view.state.doc.lineAt(pos);
				const leading = /^\s*/.exec(line.text)?.[0].length ?? 0;
				return {
					next: { kind: 'wrap', from: line.from + leading, to: line.to },
					handled: true,
				};
			}
			if (key === 'i') return { next: { kind: 'ysi' }, handled: true };
			if (key === 'a') return { next: { kind: 'ysa' }, handled: true };
			return { next: IDLE, handled: true };

		case 'ysi':
		case 'ysa': {
			const scope = state.kind === 'ysi' ? 'i' : 'a';
			if (key === 'w' || key === 'W') {
				const range = deps.resolveWordObject(scope, key);
				if (!range) return { next: IDLE, handled: true };
				return { next: { kind: 'wrap', from: range[0], to: range[1] }, handled: true };
			}
			if (isPair(key)) {
				const range = findPairRange(
					view,
					normalizePair(key),
					view.state.selection.main.head,
					scope,
				);
				if (!range) return { next: IDLE, handled: true };
				return { next: { kind: 'wrap', from: range[0], to: range[1] }, handled: true };
			}
			return { next: IDLE, handled: true };
		}

		case 'wrap':
			if (isPair(key)) {
				return {
					next: IDLE,
					handled: true,
					effect: {
						kind: 'wrap',
						from: state.from,
						to: state.to,
						ch: normalizePair(key),
					},
				};
			}
			return { next: IDLE, handled: true };

		case 'ds':
			if (isPair(key)) {
				const range = findPairRange(view, normalizePair(key), view.state.selection.main.head, 'a');
				if (range && range[1] - range[0] >= 2) {
					return {
						next: IDLE,
						handled: true,
						effect: { kind: 'deletePair', from: range[0], to: range[1] },
					};
				}
			}
			return { next: IDLE, handled: true };

		case 'cs':
			if (isPair(key)) return { next: { kind: 'csOld', old: normalizePair(key) }, handled: true };
			return { next: IDLE, handled: true };

		case 'csOld':
			if (isPair(key)) {
				const range = findPairRange(view, state.old, view.state.selection.main.head, 'a');
				if (range && range[1] - range[0] >= 2) {
					return {
						next: IDLE,
						handled: true,
						effect: {
							kind: 'changePair',
							from: range[0],
							to: range[1],
							ch: normalizePair(key),
						},
					};
				}
			}
			return { next: IDLE, handled: true };

		case 'vS':
			if (isPair(key)) {
				const sel = view.state.selection.main;
				const from = Math.min(sel.anchor, sel.head);
				const to = Math.max(sel.anchor, sel.head);
				if (from !== to) {
					return {
						next: IDLE,
						handled: true,
						effect: { kind: 'escapeAndWrap', from, to, ch: normalizePair(key) },
					};
				}
			}
			return { next: IDLE, handled: true };
	}
}

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
		// Cursor before any pair - accept the first opener forward.
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

export function installSurround(plugin: MoreVim) {
	let state: State = IDLE;

	plugin.registerDomEvent(
		activeDocument,
		'keydown',
		(event) => {
			if (event.metaKey) return;
			// Skip plain Ctrl, but allow AltGr (which browsers report as Ctrl+Alt
			// on Windows) so layouts that need it for brackets/quotes work.
			if (event.ctrlKey && !event.altKey) return;
			if (event.key === 'Escape') {
				state = IDLE;
				return;
			}
			if (event.key.length !== 1) return;

			const target = event.target as HTMLElement | null;
			if (!target) return;
			const view = EditorView.findFromDOM(target);
			if (!view) return;

			const mode = plugin.vim.mode(view);
			if (mode !== 'normal' && mode !== 'visual') return;

			// If vim is mid-sequence (e.g. user just typed `g` and we're about to
			// receive the `d` of `gd`), let vim consume the key. Without this we
			// swallow operator-like keys (`d`/`c`/`y`) that are really the second
			// char of a multi-key vim command.
			if (state.kind === 'idle' && plugin.vim.hasPendingInput(view)) return;

			const result = step(state, event.key, mode, view, {
				resolveWordObject: (scope, target) => plugin.vim.textObjectRange(view, scope, target),
			});

			state = result.next;

			if (result.effect) applyEffect(view, plugin, result.effect);

			if (result.handled) {
				event.preventDefault();
				event.stopPropagation();
				event.stopImmediatePropagation();
			}
		},
		{ capture: true },
	);
}

function applyEffect(view: EditorView, plugin: MoreVim, effect: Effect) {
	switch (effect.kind) {
		case 'wrap': {
			const [open, close] = PAIRS[effect.ch];
			view.dispatch({
				changes: [
					{ from: effect.to, to: effect.to, insert: close },
					{ from: effect.from, to: effect.from, insert: open },
				],
				selection: { anchor: effect.from },
			});
			return;
		}
		case 'deletePair': {
			view.dispatch({
				changes: [
					{ from: effect.to - 1, to: effect.to, insert: '' },
					{ from: effect.from, to: effect.from + 1, insert: '' },
				],
				selection: { anchor: effect.from },
			});
			return;
		}
		case 'changePair': {
			const [open, close] = PAIRS[effect.ch];
			view.dispatch({
				changes: [
					{ from: effect.to - 1, to: effect.to, insert: close },
					{ from: effect.from, to: effect.from + 1, insert: open },
				],
				selection: { anchor: effect.from },
			});
			return;
		}
		case 'replayKeys': {
			for (const k of effect.keys) plugin.vim.send(view, k);
			return;
		}
		case 'escapeAndWrap': {
			plugin.vim.send(view, '<Esc>');
			const [open, close] = PAIRS[effect.ch];
			view.dispatch({
				changes: [
					{ from: effect.to, to: effect.to, insert: close },
					{ from: effect.from, to: effect.from, insert: open },
				],
				selection: { anchor: effect.from },
			});
			return;
		}
	}
}

import { ViewPlugin, ViewUpdate } from '@codemirror/view';

export function scrolloff(scrolloff: () => number) {
	return ViewPlugin.fromClass(
		class {
			update(update: ViewUpdate) {
				if (scrolloff() === 0 || (!update.selectionSet && !update.docChanged)) return;

				update.view.requestMeasure({
					read(view) {
						const head = view.state.selection.main.head;
						const coords = view.coordsAtPos(head);
						if (!coords) return null;

						const rect = view.scrollDOM.getBoundingClientRect();
						const margin = scrolloff() * view.defaultLineHeight;
						const topDist = coords.top - rect.top;
						const bottomDist = rect.bottom - coords.bottom;

						if (topDist < margin) {
							return topDist - margin;
						}
						if (bottomDist < margin) {
							return margin - bottomDist;
						}

						return null;
					},
					write(delta, view) {
						if (delta != null) {
							view.scrollDOM.scrollTop += delta;
						}
					},
				});
			}
		},
	);
}

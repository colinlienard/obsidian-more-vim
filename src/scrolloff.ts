import { ViewPlugin, ViewUpdate } from '@codemirror/view';
import type MoreVim from './main';

export function scrolloff(plugin: MoreVim) {
	return ViewPlugin.fromClass(
		class {
			update(update: ViewUpdate) {
				if (plugin.settings.scrolloff === 0 || (!update.selectionSet && !update.docChanged)) return;

				update.view.requestMeasure({
					read(view) {
						const lowestHead =
							view.state.selection.ranges.length > 1
								? view.state.selection.ranges.reduce(
										(acc, curr) => (acc > curr.head ? acc : curr.head),
										view.state.selection.main.head,
									)
								: view.state.selection.main.head;
						const coords = view.coordsAtPos(lowestHead);
						if (!coords) return null;

						const rect = view.scrollDOM.getBoundingClientRect();
						const margin = plugin.settings.scrolloff * view.defaultLineHeight;
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

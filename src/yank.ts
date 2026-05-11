import type { InsertModeChanges } from '@replit/codemirror-vim';
import type MoreVim from './main';

export function setDefaultRegistryAsSystemClipboard(plugin: MoreVim) {
	const reg = new ClipboardRegister();
	const controller = plugin.vim.getRegisterController();
	controller.unnamedRegister = reg;

	plugin.registerDomEvent(window, 'focus', async () => {
		try {
			const text = await navigator.clipboard.readText();
			reg.keyBuffer = [text];
			reg.linewise = false;
			reg.blockwise = false;
		} catch {
			//
		}
	});
}

class ClipboardRegister {
	keyBuffer: string[] = [''];
	insertModeChanges: InsertModeChanges[] = [];
	searchQueries: string[] = [];
	linewise = false;
	blockwise = false;

	setText(text: string, linewise?: boolean, blockwise?: boolean) {
		this.keyBuffer = [text];
		this.linewise = !!linewise;
		this.blockwise = !!blockwise;
		void navigator.clipboard.writeText(text);
	}

	pushText(text: string, linewise?: boolean) {
		if (linewise) {
			if (!this.linewise) this.keyBuffer.push('\n');
			this.linewise = true;
		}
		this.keyBuffer.push(text);
		void navigator.clipboard.writeText(this.toString());
	}

	clear() {
		this.keyBuffer = [];
		this.linewise = false;
		this.blockwise = false;
	}

	pushInsertModeChanges(changes: InsertModeChanges) {
		this.insertModeChanges.push(changes);
	}

	pushSearchQuery(query: string) {
		this.searchQueries.push(query);
	}

	toString() {
		return this.keyBuffer.join('');
	}
}

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
	insertModeChanges: unknown[] = [];
	searchQueries: string[] = [];
	linewise = false;
	blockwise = false;

	setText(text: string, linewise?: boolean, blockwise?: boolean) {
		this.keyBuffer = [text];
		this.linewise = !!linewise;
		this.blockwise = !!blockwise;
		navigator.clipboard.writeText(text).catch(() => {});
	}

	pushText(text: string, linewise?: boolean) {
		if (linewise) {
			if (!this.linewise) this.keyBuffer.push('\n');
			this.linewise = true;
		}
		this.keyBuffer.push(text);
		navigator.clipboard.writeText(this.toString()).catch(() => {});
	}

	clear() {
		this.keyBuffer = [];
		this.linewise = false;
		this.blockwise = false;
	}

	toString() {
		return this.keyBuffer.join('');
	}
}

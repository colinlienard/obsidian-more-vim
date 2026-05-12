import type { InsertModeChanges, Vim } from '@replit/codemirror-vim';
import type MoreVim from './main';

type VimRegister = ReturnType<ReturnType<Vim['getRegisterController']>['getRegister']>;

let originalUnnamed: VimRegister | null = null;
let activeReg: ClipboardRegister | null = null;
let focusHandler: (() => void) | null = null;

export function installClipboardRegister(plugin: MoreVim) {
	if (activeReg) return;

	const controller = plugin.vim.getRegisterController();
	originalUnnamed = controller.unnamedRegister;

	const reg = new ClipboardRegister(() => plugin.settings.registrySystemClipboard);
	activeReg = reg;
	controller.unnamedRegister = reg;
	controller.registers['"'] = reg;

	focusHandler = () => {
		if (!plugin.settings.registrySystemClipboard) return;
		void syncFromClipboard(reg);
	};
	window.addEventListener('focus', focusHandler);

	if (plugin.settings.registrySystemClipboard) {
		void syncFromClipboard(reg);
	}
}

export function uninstallClipboardRegister(plugin: MoreVim) {
	if (!activeReg) return;

	if (focusHandler) {
		window.removeEventListener('focus', focusHandler);
		focusHandler = null;
	}

	const controller = plugin.vim.getRegisterController();
	if (originalUnnamed) {
		controller.unnamedRegister = originalUnnamed;
		controller.registers['"'] = originalUnnamed;
	}
	originalUnnamed = null;
	activeReg = null;
}

export function syncRegisterWithSetting(plugin: MoreVim) {
	if (!activeReg) return;
	if (plugin.settings.registrySystemClipboard) {
		void syncFromClipboard(activeReg);
	}
}

async function syncFromClipboard(reg: ClipboardRegister) {
	try {
		const text = await navigator.clipboard.readText();
		reg.keyBuffer = [text];
		reg.linewise = false;
		reg.blockwise = false;
	} catch {
		//
	}
}

class ClipboardRegister {
	keyBuffer: string[] = [''];
	insertModeChanges: InsertModeChanges[] = [];
	searchQueries: string[] = [];
	linewise = false;
	blockwise = false;

	constructor(private readonly syncEnabled: () => boolean) {}

	setText(text: string, linewise?: boolean, blockwise?: boolean) {
		this.keyBuffer = [text];
		this.linewise = !!linewise;
		this.blockwise = !!blockwise;
		if (this.syncEnabled()) void navigator.clipboard.writeText(text);
	}

	pushText(text: string, linewise?: boolean) {
		if (linewise) {
			if (!this.linewise) this.keyBuffer.push('\n');
			this.linewise = true;
		}
		this.keyBuffer.push(text);
		if (this.syncEnabled()) void navigator.clipboard.writeText(this.toString());
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

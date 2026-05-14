import { PluginSettingTab, Setting } from 'obsidian';
import MoreVim from './main';

export type Settings = {
	registerSystemClipboard: boolean;
	scrolloff: number;
	modD: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
	registerSystemClipboard: true,
	scrolloff: 0,
	modD: true,
};

export class SettingTab extends PluginSettingTab {
	plugin: MoreVim;

	constructor(plugin: MoreVim) {
		super(plugin.app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Registry system clipboard')
			.setDesc('Use the system clipboard for the default yank registry')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.registerSystemClipboard).onChange(async (value) => {
					this.plugin.settings.registerSystemClipboard = value;
					await this.plugin.saveSettings();
					this.plugin.clipboard.syncWithSetting(this.plugin);
				}),
			);

		new Setting(containerEl)
			.setName('Scrolloff')
			.setDesc('Number of lines to scroll off the edge of the screen')
			.addText((text) =>
				text
					.setPlaceholder('Enter a number')
					.setValue(this.plugin.settings.scrolloff.toString())
					.onChange(async (value) => {
						this.plugin.settings.scrolloff = parseInt(value);
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Mod-d')
			.setDesc(
				'Enable mod-d to select word under cursor, and multiple press to select multiple words. ⚠️ the mod-d hotkey should be disabled first.',
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.modD).onChange(async (value) => {
					this.plugin.settings.modD = value;
					await this.plugin.saveSettings();
				}),
			);
	}
}

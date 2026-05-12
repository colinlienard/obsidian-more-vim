import { PluginSettingTab, Setting } from 'obsidian';
import MoreVim from './main';
import { syncRegisterWithSetting } from './yank';

export type Settings = {
	registrySystemClipboard: boolean;
	scrolloff: number;
};

export const DEFAULT_SETTINGS: Settings = {
	registrySystemClipboard: true,
	scrolloff: 0,
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
				toggle.setValue(this.plugin.settings.registrySystemClipboard).onChange(async (value) => {
					this.plugin.settings.registrySystemClipboard = value;
					await this.plugin.saveSettings();
					syncRegisterWithSetting(this.plugin);
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
	}
}

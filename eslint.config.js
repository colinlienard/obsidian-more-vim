import ts from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';

export default [
	{
		ignores: ['main.js', 'esbuild.config.mjs', 'eslint.config.js', 'version-bump.mjs'],
	},
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
			},
		},
	},
	...ts.configs.recommended,
	...obsidianmd.configs.recommended,
	{
		files: ['**/*.ts'],
		languageOptions: {
			parser: ts.parser,
			parserOptions: {
				project: './tsconfig.json',
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
		},
	},
];

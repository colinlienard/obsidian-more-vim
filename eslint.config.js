import ts from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globalsPkg from 'globals';

const globals = /** @type {Record<string, Record<string, 'readonly' | 'writable' | 'off'>>} */ (
	globalsPkg
);

export default [
	{
		ignores: ['main.js'],
	},
	{
		languageOptions: {
			globals: {
				...globals.browser,
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
	},
	{
		files: ['**/*.{js,mjs,cjs}'],
		...ts.configs.disableTypeChecked,
	},
];

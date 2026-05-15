import ts from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';

export default [
	{
		ignores: ['main.js'],
	},
	{
		languageOptions: {
			globals: {
				window: 'readonly',
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

# More Vim — Obsidian plugin

## What this plugin does

Adds vim features that Obsidian's built-in vim mode is missing. It runs on top of
the editor's existing `@replit/codemirror-vim` integration — it does **not**
ship its own vim engine. Each feature reaches into that integration to extend or
replace specific behaviors.

Current features (see `manifest.json` → `id: more-vim`, desktop only):

| Feature | Where | Behavior |
| --- | --- | --- |
| `gd` | `src/commands.ts` | Open the internal link under the cursor (Obsidian wiki-link). |
| `gx` | `src/commands.ts` | Open the external URL under the cursor in a new browser tab. |
| `o` | `src/commands.ts` | Open a new line **preserving Markdown list continuation** (default vim `o` breaks lists). Implemented by going to end-of-line, entering insert with `A`, then dispatching a synthetic Enter so Obsidian's list handler fires. |
| System-clipboard register | `src/yank.ts` | Replaces the unnamed (`"`) register with a `ClipboardRegister` that mirrors yanks/puts to `navigator.clipboard` and re-syncs on window focus. Toggleable via settings. |
| `scrolloff` | `src/scrolloff.ts` | Keeps N lines of context above/below the cursor, like vim's `scrolloff`. CodeMirror `ViewPlugin` that measures cursor coords and adjusts `scrollDOM.scrollTop`. |
| `Mod-d` select word / next match | `src/select-word.ts` | Empty selection → run `viw` to select word. Non-empty → find next occurrence of the selection and add a cursor there. Wraps to start when no more matches below. |
| Multi-cursor motions | `src/multi-cursor.ts` | When >1 selection range exists in normal mode, intercept `h j k l w W b B e E $ ^` and run them **per cursor** by temporarily collapsing to each range, invoking vim's `handleKey`, and reassembling. `Escape` collapses back to the main cursor. |

## Architecture

### Lifecycle (`src/main.ts`)

The plugin can't initialize until a Markdown view exists, because that's where
the vim instance lives. So `onload` only registers an `active-leaf-change`
listener; on the first leaf with a CodeMirror editor it:

1. Calls `init()` to grab the vim instance via `getCM(view)` and stash `this.vim` / `this.cm`.
2. Calls `defineCommands(this)` to register vim normal-mode actions.
3. Installs the clipboard register.
4. Registers the three CodeMirror editor extensions (`scrolloff`, `selectWord`, `multiCursor`) via `registerEditorExtension`.

The `if (this.vim) return` guard means initialization runs **once per session**.
`onunload` only uninstalls the clipboard register — Obsidian cleans up the
editor extensions and event listeners automatically because they're all
registered via `this.register*` helpers.

### Two ways to add behavior

**Vim actions** (use when the feature should feel like a vim command bound to a
normal-mode key sequence):

```ts
plugin.vim?.defineAction(name, fn);
plugin.vim?.mapCommand(keys, 'action', name, {}, { context: 'normal' });
```

See `defineCommand` in `src/commands.ts`. The action receives a `CodeMirrorV`
and can use `plugin.vim?.handleKey(cm, key, 'user')` to chain into other vim
commands.

**CodeMirror keymap / view extensions** (use when you need to intercept a key
before vim sees it, or hook into editor updates):

```ts
Prec.highest(keymap.of([{ key: 'Mod-d', run(view) { ... } }]))
```

`Prec.highest` is required so the binding wins over vim's own keymap. Use
`plugin.vimMode` (getter in `main.ts`) to check the current mode and bail out
when the binding shouldn't apply.

### Accessing internals

Both Obsidian and `@replit/codemirror-vim` expose some things only through
private fields. The codebase uses `@ts-expect-error` (with a short comment) at
each such site rather than redeclaring types:

- `editor.cm` → the underlying `EditorView` (Obsidian internal).
- `editor.getClickableTokenAt(pos)` → returns `{ type, text }` for links under the cursor.
- `cm.constructor.Vim` → the static `Vim` namespace from `@replit/codemirror-vim`.

If you add a new one, follow the same pattern: cast at the boundary, give it a
real type at use sites.

## Tooling

- **Package manager: pnpm** (`packageManager: pnpm@11.0.9` in `package.json`, `pnpm-lock.yaml` is committed). Don't run `npm install` — it'll desync the lockfile.
- **Bundler: esbuild** (`esbuild.config.mjs`). Outputs `main.js` at the repo root. CodeMirror and Obsidian packages are marked `external` so Obsidian provides them at runtime.
- **TypeScript: strict.** Run `pnpm typecheck` (alias for `tsc --noEmit`). The production build (`pnpm build`) typechecks first, then bundles.
- **Linter: ESLint flat config** with `typescript-eslint` + `eslint-plugin-obsidianmd`. `no-unsafe-assignment` and `no-unsafe-call` are disabled because of all the internal-API casts. Run `pnpm lint`.
- **Formatter: Prettier** — tabs, single quotes, print width 100. Run `pnpm format:fix`.

### Scripts

```bash
pnpm install        # install dependencies
pnpm dev            # esbuild watch — rebuilds main.js on change
pnpm build          # typecheck + production bundle
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint .
pnpm format:fix     # prettier --write .
```

## Testing changes in a vault

esbuild writes `main.js` next to `manifest.json` at the repo root, which means
**the repo itself can be a plugin folder**. Symlink (or clone directly into)
`<Vault>/.obsidian/plugins/more-vim/`, then in Obsidian: **Settings → Community
plugins**, disable + re-enable "More Vim" to reload after each rebuild. The
plugin is desktop-only (`isDesktopOnly: true`), so no mobile testing.

There is no automated test suite — verify behavior manually in a real vault.
Watch for:

- The `active-leaf-change` init runs only once. If you change `onload` logic, reload the plugin (not just the leaf) to retest.
- The `Mod-d` Obsidian hotkey must be disabled by the user first (it's documented in the settings tab).

## Conventions

- Source lives in `src/`. Keep `main.ts` to lifecycle only; each feature is its own file.
- Each editor-extension factory takes `plugin: MoreVim` and returns the extension. This is how features read live settings (`plugin.settings.scrolloff`, etc.) without re-registering on every change.
- Settings are a flat object (`src/settings.ts`); add a key to both the `Settings` type and `DEFAULT_SETTINGS`, then a `new Setting(containerEl)` row in `SettingTab.display`. If a setting needs to take effect immediately (like `registerSystemClipboard`), call a sync function from the `onChange` handler — see `syncRegisterWithSetting`.
- Stable command/action IDs: don't rename strings passed to `defineAction` / `mapCommand` once shipped.
- Prefer `import type` for type-only imports (the codebase does this consistently).

## Release

- `manifest.json` — bump `version` (no `v` prefix), update `minAppVersion` if you started using a newer API.
- `versions.json` — add `"new-version": "minAppVersion"`.
- `pnpm version <patch|minor|major>` runs `version-bump.mjs`, which updates both files and stages them.
- Create a GitHub release with the exact version as the tag. Attach `main.js` and `manifest.json` as individual assets (not a zip).
- Never change `manifest.json#id` — it's the plugin's stable identity in users' vaults.

## Common pitfalls

- **`Prec.highest` is required** for keymap extensions that should beat vim. Without it your `Mod-d` / Escape / motion bindings won't fire.
- **`handleKey` runs synchronously and mutates selection** — that's why `multi-cursor.ts` can do `dispatch single → handleKey → read selection.main` in a loop. Don't try to parallelize it.
- **The clipboard register reads on window `focus`**, not on every keystroke, to avoid permission prompts. If clipboard sync feels stale during a long session, that's why.
- **Internal-API access can break on Obsidian updates.** When something stops working after a version bump, suspect `editor.cm`, `editor.getClickableTokenAt`, and `cm.constructor.Vim` first.
- **Don't introduce network calls.** This plugin is purely local; adding fetches would require user opt-in and clear disclosure per Obsidian's developer policy.

## References

- Obsidian API: https://docs.obsidian.md
- Developer policies: https://docs.obsidian.md/Developer+policies
- Plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- `@replit/codemirror-vim`: https://github.com/replit/codemirror-vim
- CodeMirror 6 reference: https://codemirror.net/docs/ref/

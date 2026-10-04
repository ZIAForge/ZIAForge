# Interface localization

ZIAForge has 56 registered interface locales. `src/locales/en.json` is the canonical English catalog; catalog completeness is checked against the current English key set. `src/languages.ts` retains the existing locale IDs and native language names.

The 2026-10 update uses machine translations with contextual AI review. Catalog completeness, placeholder checks and a limited terminology review do **not** constitute review or certification by native-language humans. Full Help bodies have a separate canonical source, per-language source hash and translation status. Current-source machine translations carry an explicit notice; missing or stale bodies fall back to English. Interface key parity does not prove Help translation completeness; see [HELP_MAINTENANCE.md](HELP_MAINTENANCE.md).

## Runtime contract

- `src/i18n-core.ts` has no React or store dependency. It exports `translate(locale, key, values?)`, `translateText`, `normalizeLocale`, `isRtlLocale`, and date/number formatting helpers for renderer and backend UI.
- React components use `useTranslation`; event handlers and legacy display wrappers can use `uiText`. Prefer an explicit key when identical English words have different grammatical contexts. Menu names must not override an action's translation.
- Preserve every `{placeholder}` exactly. Values are inserted once and remain data, including paths, user text and literal braces. Number values use `Intl.NumberFormat`; dates use `Intl.DateTimeFormat`.
- Count variants use CLDR categories (`.zero`, `.one`, `.two`, `.few`, `.many`, `.other`) selected by `Intl.PluralRules`. Use the category appropriate to the target language rather than assuming every non-one count is the same.
- Arabic, Persian, Urdu, Western Punjabi, Pashto and Sindhi use RTL. Kurmanji uses Latin/LTR. Code, protocol identifiers, paths and technical fields retain LTR; user messages use their own direction.
- Changing editor language reconfigures localized CodeMirror facets and search controls without recreating the document, undo history or saved draft.

Do not translate model/provider IDs, JSON fields, slash commands, hashes, source code, user/provider content or raw CLI/backend diagnostics. Brands and established technical terms may retain their spelling. Mock external-page content is distinguished from application UI. A task folder/worktree is not an OS sandbox; localized access descriptions must preserve this distinction and every approval boundary.

## Maintaining catalogs

1. Add a contextual English key and translations to all registered catalogs. Keep protocol values separate from display labels.
2. Preserve placeholders, negation, limits and command examples. Use the locale's script and natural UI terminology. Do not insert English prose as a fallback translation.
3. Run the inexpensive structural check after the complete edit:

   ```sh
   npm run locales:check
   npm run locales:audit
   ```

The check verifies key parity, nonempty values, placeholder parity, literal command/JSON preservation, registry consistency and registration of static English UI sources. The audit additionally lists English-identical short labels and visible source literals. Homographs (for example French `section`), loanwords, filenames and mock content need contextual classification; matching English alone is not evidence of an error.

Focused regressions are `src/__tests__/i18n-core.test.ts` and `src/features/workspace/__tests__/FileEditor.localization.test.tsx`. Run TypeScript and scoped lint for runtime changes. Coordinate any application build or GUI inspection with the release owner; do not rebuild shared output for every translation batch.

## Registered locales

| Code | Language Name | Script / Writing System |
|---|---|---|
| `am` | Amharic (አማርኛ) | Ge'ez |
| `ar` | Arabic (العربية) | Arabic |
| `az` | Azerbaijani (Azərbaycanca) | Latin |
| `bho` | Bhojpuri (भोजपुरी) | Devanagari |
| `bn` | Bengali (বাংলা) | Bengali |
| `ceb` | Cebuano (Cebuano) | Latin |
| `de` | German (Deutsch) | Latin |
| `en` | English | Latin |
| `es` | Spanish (Español) | Latin |
| `fa` | Persian (فارسی) | Arabic |
| `ff` | Fula/Fulani (Fulfulde) | Latin |
| `fr` | French (Français) | Latin |
| `gu` | Gujarati (ગુજરાતી) | Gujarati |
| `ha` | Hausa (Hausa) | Latin |
| `hi` | Hindi (हिन्दी) | Devanagari |
| `id` | Indonesian (Bahasa Indonesia) | Latin |
| `ig` | Igbo (Asụsụ Igbo) | Latin |
| `it` | Italian (Italiano) | Latin |
| `ja-JP` | Japanese (日本語) | Kanji/Kana |
| `jv` | Javanese (Basa Jawa) | Latin |
| `kk` | Kazakh (Қазақша) | Cyrillic |
| `km` | Khmer (ភាសាខ្មែរ) | Khmer |
| `kn` | Kannada (ಕನ್ನಡ) | Kannada |
| `ko` | Korean (한국어) | Hangul |
| `ku` | Kurdish (Kurdî) | Latin |
| `mai` | Maithili (मैथिली) | Devanagari |
| `mg` | Malagasy (Malagasy) | Latin |
| `ml` | Malayalam (മലയാളം) | Malayalam |
| `mr` | Marathi (मराठी) | Devanagari |
| `my` | Burmese (မြန်မာဘာသာ) | Burmese |
| `ne` | Nepali (नेपाली) | Devanagari |
| `nl` | Dutch (Nederlands) | Latin |
| `om` | Oromo (Afaan Oromoo) | Latin |
| `or` | Odia/Oriya (ଓଡ଼ିଆ) | Odia |
| `pa` | Eastern Punjabi (ਪੰਜਾਬੀ) | Gurmukhi |
| `pl` | Polish (Polski) | Latin |
| `pnb` | Western Punjabi (پنجابی) | Shahmukhi |
| `ps` | Pashto (پښتو) | Arabic |
| `pt-BR` | Portuguese (Português Brasil) | Latin |
| `ro` | Romanian (Română) | Latin |
| `ru` | Russian (Русский) | Cyrillic |
| `sd` | Sindhi (سنڌي) | Arabic |
| `so` | Somali (Soomaali) | Latin |
| `su` | Sundanese (Basa Sunda) | Latin |
| `ta` | Tamil (தமிழ்) | Tamil |
| `te` | Telugu (తెలుగు) | Telugu |
| `th` | Thai (ไทย) | Thai |
| `tl` | Tagalog (Tagalog) | Latin |
| `tr` | Turkish (Türkçe) | Latin |
| `uk` | Ukrainian (Українська) | Cyrillic |
| `ur` | Urdu (اردو) | Arabic |
| `uz` | Uzbek (O'zbekcha) | Latin |
| `vi` | Vietnamese (Tiếng Việt) | Latin |
| `yo` | Yoruba (Ede Yoruba) | Latin |
| `zh-CN` | Chinese Simplified (简体中文) | Hanzi |
| `zh-TW` | Chinese Traditional (繁體中文) | Hanzi |

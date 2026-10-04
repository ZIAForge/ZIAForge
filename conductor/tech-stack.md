# Технологический стек: ZIAForge

## 1. Десктопная платформа и системный уровень
* **Контейнер:** Electron `30.5.1` (Architecture: `contextIsolation: true`, `nodeIntegration: false`).
* **Платформа:** Node.js runtime.
* **Терминальный движок:** `node-pty` `1.1.0` (нативная сборка для macOS darwin-x64/arm64).
* **Сборка десктопа:** `electron-builder` `24.13.3` (генерация `.dmg` и portable `.app`).

## 2. Пользовательский интерфейс и фронтенд
* **Фреймворк:** React `18.3.1` + TypeScript `5.x` (Strict mode).
* **Сборщик бандлов:** Vite `5.4.x` (модули `dist` и `dist-electron`).
* **Стилизация:** Tailwind CSS `3.4.x` + PostCSS + Autoprefixer.
* **Иконки:** `lucide-react` `0.344.x`.
* **Терминал в UI:** `xterm` `5.5.0` + `@xterm/addon-fit` + `@xterm/addon-canvas`.
* **Управление состоянием:** Zustand `4.5.x`.
* **Интернационализация:** Кастомный движок `i18n.ts` с поддержкой 50+ локалей (RU, EN и др.).

## 3. Интеграция с ИИ и агентами
* **Официальные CLI агенты:**
  * Google Antigravity CLI (`agy`) — поддержка headless stream-json и PTY.
  * Claude Code (`claude`) — поддержка `--output-format stream-json`.
  * OpenAI Codex — интеграция через Codex App Server (stdio JSONL).
* **Шлюз моделей:** LiteLLM Gateway (`http://127.0.0.1:4000/v1`) для OpenAI-совместимых запросов к облачным и локальным моделям (Ollama, vLLM).
* **Протоколы:** Поддержка Model Context Protocol (MCP) и Agent Client Protocol (ACP).

## 4. Контроль версий и изоляция
* **Система контроля версий:** Git CLI.
* **Изоляция сред исполнения:** Git Worktrees (`git worktree add / remove / prune`).

## 5. Контроль качества и стандарты
* **Проверка типов:** `tsc --noEmit`.
* **Линтинг:** ESLint + TypeScript ESLint.
* **Тестирование:** Vitest для модульных тестов и регрессионных проверок парсера/состояния.

# План реализации трека: Переход на типизированные потоковые протоколы агентов (Stream JSON), декомпозиция Workspace и запуск автономного TDD-цикла

**Track ID:** `agent_streaming_and_workspace_decomposition_20260910`  
**Статус:** `Pending`  
**Дата создания:** `2026-09-10`

---

## Фаза 1: Тестовая среда и устранение регрессионных рисков ядра [checkpoint: f0c2953]

- [x] Задача 1.1: Установка и конфигурация Vitest, юнит-раннера и скриптов CI (a9be4a6)
  - Описание: Добавить `vitest` и `@testing-library/react` в `devDependencies`. Настроить `vitest.config.ts`, добавить `npm run test` и `npm run test:coverage` в `package.json`.
  - Файлы: `package.json`, `vitest.config.ts`
  - Верификация: `CI=true npm run test` выполняется без ошибок.

- [x] Задача 1.2: Устранение остаточных рисков завершения процессов и fallback CWD (72fa541)
  - Описание: В `electron/main.ts` устранить глобальный перебор процессов в `kill-process-by-command`. Добавить строгую проверку принадлежности PID процессу задачи. В `spawn-pty` запретить fallback в `$HOME` при отсутствии пути задачи.
  - Файлы: `electron/main.ts`
  - Верификация: Юнит-тест на отказ завершения чужого PID и проверку валидации `cwd`.

- [x] Задача 1.3: Юнит-тестирование базовых служб ядра (4670391)
  - Описание: Написать тесты для валидации сессий, путей Worktree и изоляции логов задач в `src/store.ts`.
  - Файлы: `src/__tests__/store.test.ts`
  - Верификация: `npm run test` подтверждает 100% прохождение тестов.

- [x] Задача 1.4: Phase Verification & Checkpoint (f0c2953)
  - Описание: Полная проверка фазы 1, запуск автоматических тестов и ручная верификация.
  - Верификация: `CI=true npm run test` и фиксация git note.

---

## Фаза 2: Архитектура Execution Layer: RunService, SessionRegistry и EventJournal [checkpoint: 67db9ea]

- [x] Задача 2.1: Контракт типов событий и команд (d699b1d)
  - Описание: Создать `shared/agent-events.ts` и `shared/agent-commands.ts` с типами `AgentEvent`, `MessageDelta`, `ToolCall`, `ApprovalRequest`.
  - Файлы: `shared/agent-events.ts`, `shared/agent-commands.ts`
  - Верификация: `npx tsc --noEmit` проходит без ошибок.

- [x] Задача 2.2: Реализация append-only журнала EventJournal (837eebc)
  - Описание: Реализовать `electron/runtime/EventJournal.ts` для записи и чтения NDJSON потоков событий задач с возможностью replay и детерминированного восстановления состояния.
  - Файлы: `electron/runtime/EventJournal.ts`, `electron/runtime/__tests__/EventJournal.test.ts`
  - Верификация: Тест `EventJournal.test.ts` проверяет запись 1000 событий и корректное чтение replay.

- [x] Задача 2.3: Реализация RunService и SessionRegistry (cdfd989)
  - Описание: Создать `electron/runtime/RunService.ts` и `SessionRegistry.ts`. Перенести запуск и мониторинг процессов из React в Electron. Обеспечить идемпотентный запуск по `taskId` и `runId`.
  - Файлы: `electron/runtime/RunService.ts`, `electron/runtime/SessionRegistry.ts`
  - Верификация: Тест `RunService.test.ts` подтверждает, что повторный старт задачи не создает дублирующий процесс.

- [x] Задача 2.4: Phase Verification & Checkpoint (67db9ea)
  - Описание: Контрольная верификация фазы 2.
  - Верификация: `CI=true npm run test:coverage` (66 тестов зеленые), кросс-ревью с Codex (полный sign-off получен) и фиксация git note.

---

## Фаза 3: Эталонный адаптер Codex (stdio JSON-RPC app-server) и служба разрешений [checkpoint: eaacf71]

- [x] Задача 3.1: Реализация клиента CodexAdapter (двусторонний JSON-RPC stdio) (efcebec)
  - Описание: Создать `electron/agents/CodexAdapter.ts`, запускающий `codex app-server --listen stdio://`. Реализовать обработку `item/agentMessage/delta`, `item/started`, `item/completed`.
  - Файлы: `electron/agents/CodexAdapter.ts`, `electron/agents/__tests__/CodexAdapter.test.ts`
  - Верификация: Интеграционный тест декодирования JSON-RPC потока и генерации `AgentEvent`.

- [x] Задача 3.2: Служба разрешений ApprovalRegistry (d2e8ac6)
  - Описание: Создать `electron/runtime/ApprovalRegistry.ts` с поддержкой уникальных `approvalId`, состояний (`pending`, `submitting`, `resolved`, `expired`) и ответа в исходный RPC-запрос.
  - Файлы: `electron/runtime/ApprovalRegistry.ts`, `electron/runtime/__tests__/ApprovalRegistry.test.ts`
  - Верификация: Тест доставки решения (allow/deny) по корректному RPC ID.

- [x] Задача 3.3: Phase Verification & Checkpoint (eaacf71)
  - Описание: Контрольная верификация фазы 3.
  - Верификация: `CI=true npm test` (107 тестов зеленые), полный sign-off от Codex (`gpt-6-astra`, `effort: max`, вердикт `STATUS: APPROVED`) и фиксация git note.

---

## Фаза 4: Потоковые адаптеры Antigravity CLI и Claude Code [checkpoint: e8e2cf9]

- [x] Задача 4.1: Адаптер AntigravityAdapter (NDJSON stream-json) (2042fc2)
  - Описание: Создать `electron/agents/AntigravityAdapter.ts`, запускающий `agy --input-format stream-json --output-format stream-json`. Поддержка событий `step_update` и `result`.
  - Файлы: `electron/agents/AntigravityAdapter.ts`, `electron/agents/__tests__/AntigravityAdapter.test.ts`
  - Верификация: 48 тестов зеленые, покрытие строк 86.5%, функций 93.87%, TypeScript & ESLint чистые, полный sign-off от Codex (`gpt-6-astra`, `effort: max`, вердикт `STATUS: APPROVED`).

- [x] Задача 4.2: Адаптер ClaudeAdapter (stream-json с частичными сообщениями) (684f25b)
  - Описание: Создать `electron/agents/ClaudeAdapter.ts`, запускающий `claude` с `--output-format stream-json --include-partial-messages`.
  - Файлы: `electron/agents/ClaudeAdapter.ts`, `electron/agents/__tests__/ClaudeAdapter.test.ts`
  - Верификация: 73 теста зеленые, строгая защита от зомби-процессов, дедупликация дельт и снапшотов, границы буферов памяти, TypeScript & ESLint чистые, полный sign-off от Codex (`gpt-6-astra`, `effort: max`, вердикт `STATUS: APPROVED`).

- [x] Задача 4.3: Фабрика адаптеров и capability gating (427e1be)
  - Описание: Создать `electron/agents/AgentAdapterFactory.ts`, выбирающую адаптер по модели/провайдеру задачи с проверкой поддерживаемых возможностей.
  - Файлы: `electron/agents/AgentAdapterFactory.ts`, `electron/agents/__tests__/AgentAdapterFactory.test.ts`, `electron/agents/CodexAdapter.ts`, `electron/agents/AntigravityAdapter.ts`, `electron/agents/ClaudeAdapter.ts`
  - Верификация: 37 тестов фабрики зеленые, строгий capability gating (запрет вложений, интерактивные подтверждения только для Codex), защита от прототипного загрязнения (strict own property), полиморфный контракт `AgentAdapter` с геттерами идентичности (`getCapabilities`, `getProvider`, `getTaskId`, `getRunId`, `getSessionId`), безупречный FSM жизненного цикла в `CodexAdapter` (гарантированное удержание `isStopping` до завершения `terminateChildProcess` с эскалацией SIGKILL, восстановление `idle` при рестарте, сохранение терминальных `error`/`stopped` статусов), TypeScript & ESLint чистые, полный sign-off от Codex (`gpt-6-astra`, `effort: max`, вердикт `STATUS: APPROVED`).

- [x] Задача 4.4: Phase Verification & Checkpoint (Refer to workflow.md)
  - Описание: Контрольная верификация фазы 4.
  - Верификация: 290 тестов зеленые (`CI=true npm test`), `npx tsc --noEmit` и `npx eslint electron/agents/` без ошибок, сертификационный аудит Codex (`gpt-6-astra`, `effort: max`) завершен с официальным вердиктом `STATUS: APPROVED`. Получено подтверждение пользователя. Checkpoint зафиксирован.

---

## Фаза 5: Декомпозиция UI Workspace.tsx на модульные компоненты

- [x] Задача 5.1: Извлечение ConversationFeed.tsx
  - Описание: Создать `src/features/workspace/ConversationFeed.tsx`. Рендерить чат напрямую из проекций `EventJournal` (без парсинга ANSI-экрана).
  - Файлы: `src/features/workspace/ConversationFeed.tsx`, `src/features/workspace/__tests__/ConversationFeed.test.tsx`, `shared/agent-events.ts`, `electron/runtime/EventJournal.ts`
  - Верификация: 19 тестов зеленые, строгая мемоизация с версионированием ревизий сообщений (0 лишних ререндеров истории при поступлении новых токенов), WeakMap-кэширование legacy-строк, автоскролл с защитой позиции скролла пользователя и возобновлением слежения, полная локализация без дубликатов, TypeScript & ESLint чистые, официальный вердикт аудита Codex (`gpt-6-astra`, `effort: max`): `STATUS: APPROVED`.

- [x] Задача 5.2: Извлечение TerminalPane.tsx
  - Описание: Создать `src/features/workspace/TerminalPane.tsx`. Подключить чистый xterm.js для отображения сырого вывода процесса и шелла.
  - Файлы: `src/features/workspace/TerminalPane.tsx`, `src/features/workspace/__tests__/TerminalPane.test.tsx`, `src/locales/en.json`, `src/locales/ru.json`
  - Верификация: 17 тестов зеленые, автономное управление xterm.js и FitAddon, строгая изоляция от состояния чата (0 записей в store feeds), in-band hard reset (`\x1bc`) для предотвращения смешивания буферов, динамическое обновление геометрии PTY при изменении шрифтов, полная очистка ресурсов при сбоях инициализации и анмаунте, TypeScript & ESLint чистые, официальный вердикт аудита Codex (`gpt-6-astra`, `effort: max`): `STATUS: APPROVED`.

- [x] Задача 5.3: Извлечение Composer.tsx и ApprovalCard.tsx
  - Описание: Создать `src/features/workspace/Composer.tsx` (ввод, прикрепление файлов, выбор модели) и `src/features/workspace/ApprovalCard.tsx` (интерактивные карточки запросов прав с явными кнопками), а также подкомпоненты `ModelSelectorDropdown.tsx`, `ComposerAttachments.tsx`, `ActiveProcessesToolbar.tsx`.
  - Файлы: `src/features/workspace/Composer.tsx`, `src/features/workspace/ApprovalCard.tsx`, `src/features/workspace/ModelSelectorDropdown.tsx`, `src/features/workspace/ComposerAttachments.tsx`, `src/features/workspace/ActiveProcessesToolbar.tsx`, `src/features/workspace/__tests__/Composer.test.tsx`, `src/features/workspace/__tests__/ApprovalCard.test.tsx`
  - Верификация: 30 тестов зеленые (Composer: 19, ApprovalCard: 11, всего по Workspace: 66/66, проект: 356/356), защита от потери черновика при сбое отправки и сохранение свежего контролируемого черновика B, защита IME composition при Enter, блокировка двойных кликов и race conditions в ApprovalCard через attemptIdRef, корректное сохранение выбора auto при обновлении customModels, чистые уведомления без сайд-эффектов в React updater, поддержка StrictMode без предупреждений, все файлы Задачи 5.3 строго < 400 строк (Composer: 382, ModelSelectorDropdown: 333, ApprovalCard: 204), TypeScript & ESLint чистые, официальный вердикт аудита Codex (`gpt-6-astra`, `effort: max`): `STATUS: APPROVED`.

- [x] Задача 5.4: Извлечение PlanPanel.tsx и сборка WorkspaceShell.tsx (30103b2)
  - Описание: Создать `src/features/workspace/PlanPanel.tsx` и финальный `src/features/workspace/WorkspaceShell.tsx`, заменив монолитный `Workspace.tsx`.
  - Файлы: `src/features/workspace/PlanPanel.tsx`, `src/features/workspace/WorkspaceShell.tsx`, `src/features/workspace/EditStepModal.tsx`, `src/features/workspace/__tests__/PlanPanel.test.tsx`, `src/features/workspace/__tests__/WorkspaceShell.test.tsx`, `src/components/Workspace.tsx`
  - Верификация: Все 67/67 аудиторских проб зеленые, память буферов проверена на 0 утечек, PlanPanel (264 строк), WorkspaceShell (431 строк), EditStepModal (213 строк) строго в пределах спецификации (< 500 строк), TypeScript & ESLint чистые, полный тестовый контур (407/407) пройден, сборка `npx vite build` успешна, сертификационный аудит Codex (`gpt-6-astra`, `effort: max`) завершен с официальным вердиктом `STATUS: APPROVED`.

- [ ] Задача 5.5: Phase Verification & Checkpoint (Refer to workflow.md)
  - Описание: Контрольная верификация фазы 5.

---

## Фаза 6: Автономный TDD-цикл (WorkflowEngine) и финальная сквозная верификация

- [ ] Задача 6.1: Реализация WorkflowEngine.ts и VerificationRunner.ts
  - Описание: Создать `electron/workflow/WorkflowEngine.ts` и `electron/workflow/VerificationRunner.ts` для автоматического запуска проверок в Worktree задачи с фиксацией Red и Green состояний.
  - Файлы: `electron/workflow/WorkflowEngine.ts`, `electron/workflow/VerificationRunner.ts`
  - Верификация: Тест конечного автомата Red -> Green с лимитом повторных попыток.

- [ ] Задача 6.2: Автоматический коммит в Git Worktree
  - Описание: Создавать Git-коммит в ветке задачи только после подтверждения Green от `VerificationRunner`.
  - Файлы: `electron/workflow/WorkflowEngine.ts`
  - Верификация: Проверка создания коммита в тестовом репозитории.

- [ ] Задача 6.3: Комплексная сборка, упаковка и обновление /Applications/ZIAForge.app
  - Описание: Выполнить `npm run test`, `npx tsc --noEmit`, сборку `npm run build`, обновить бандл `/Applications/ZIAForge.app`.
  - Файлы: Все
  - Верификация: `app.asar` обновлен, приложение запускается успешно.

- [ ] Задача 6.4: Phase Verification & Checkpoint (Refer to workflow.md)
  - Описание: Финальная верификация трека.

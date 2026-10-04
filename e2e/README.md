# Electron E2E

For retained evidence and a fresh output directory, use the repository QA commands:

```sh
npm run qa:doctor
npm run qa:check -- --e2e
```

These are fixture checks, not live LLM validation. Each run saves `manifest.json`,
`result.json`, logs and a Playwright report under a new `test-results/qa/` directory.
See [Testing and inspection](../docs/TESTING.md) for `qa:inspect`, source identity
and the explicit fixture/replay/live distinction.

```sh
npm ci
npm run test:e2e
```

Команда собирает renderer, main и preload, затем запускает настоящее окно Electron через
[`_electron.launch`](https://playwright.dev/docs/api/class-electron).
Для повторного запуска готовой сборки: `npx playwright test`.
Для пошаговой отладки: `npm run test:e2e:debug`.
Отдельная установка Chromium не нужна: используется Electron из зависимостей проекта.

Сценарии проверяют:

- каталог `agy models`, который отвечает дольше прежнего таймаута 2000 мс;
- передачу модели из пресета в аргумент `--model`;
- отправку сообщений через настоящий IPC и `node-pty`, подтверждение с `\r`;
- варианты `1)`, `[2]`, `(3)`, `(y/N)` и ответы в отдельной PTY каждой вкладки;
- фильтрацию команд настройки шелла и строки состояния модели;
- сохранение обоих пресетов по умолчанию и свободный ввод модели.
- состояние Composer: Stop появляется по признакам генерации в PTY, скрыт при
  запуске, авторизации, очереди отправки, ожидании разрешения и возврате к промпту;
- новый чат с двумя ходами «Привет» → задача на mock авторизацию, порядок сообщений;
- Ctrl+C в текущей вкладке: следующая отправка использует тот же PID, соседняя вкладка продолжает работу.

`task-chat-flow.spec.ts` сохраняет `screenshots/chat-step1-idle.png`,
`screenshots/chat-step2-greeting.png`, `screenshots/chat-step3-task.png` и
дополнительный `screenshots/chat-step3-permission.png`. Эти файлы также прикладываются
к отчёту Playwright. После разрешения тестовый CLI создаёт `index.html` в изолированной
рабочей папке и запускает HTTP-сервер на свободном порту localhost; тест проверяет его ответ.

`new-chat-idle.spec.ts` проверяет незаполненный новый чат на задаче со статусом
`running`. Для запуска только этого сценария:

```sh
npm run build:e2e
npx playwright test e2e/new-chat-idle.spec.ts
```

Сценарий воспроизводит 35 пакетов записи agy 1.2.1 из
`fixtures/agy-startup.json` через настоящий PTY. Адрес аккаунта в записи обезличен.
Это воспроизведение записанного вывода; сетевой авторизации в тесте нет.
Дополнительная перерисовка без footer проверяет регрессию: отсутствие распознанного
промпта само по себе не должно означать генерацию.

После пауз 0,5–3 секунды сохраняются десять снимков всего интерфейса в
`test-results/e2e/<сценарий>/e2e-screenshots/` (или каталог текущего QA-запуска): открытая задача, созданный чат,
авторизация, готовый баннер, промежуточная перерисовка, стабильный idle,
генерация, соседняя вкладка, переподключённая генерация и отмена.
`MutationObserver` дополнительно проверяет, что Stop не появлялся ни на одном
обновлении DOM до первой отправки. Наблюдения и PID/сообщения CLI прикладываются
к отчёту как `idle-stop-observations.json` и `cli-transcript.json`.
Перед проверкой Stop после отправки сценарий подтверждает фактическую доставку
`long-generation` ровно один раз в нужный PID по transcript локального CLI.
Начальные native bounds окна проверяются против реального `screen.workArea`
и сохраняются в `startup-window-geometry.json`. На macOS окно должно занимать
workArea без native fullscreen; resize/activate и close/reopen сохраняют renderer
и сессию. После Stop следующий запрос должен прийти ровно один раз тому же PID.
Если Electron не смог создать окно, снимков не будет: ошибка запуска не считается
пройденной визуальной проверкой.

Каждый тест получает собственный каталог `test-results/e2e/.../profile` (либо внутри QA-запуска) с настройками,
задачей, рабочей папкой и историей. `bootstrap.cjs` задаёт `userData` до загрузки
main. В режиме E2E приложение пропускает чтение окружения login shell,
изменение настроек доверия Antigravity и splash screen. Этот режим отключён в
упакованном приложении.

Тестовый `agy` — локальный дочерний процесс внутри настоящего PTY. Он работает в
raw mode, воспринимает LF как перенос строки, CR как отправку и записывает
полученные сообщения, PID и модель в `profile/transcript.jsonl`. Обращений к
LLM и пользовательским учётным записям в этих сценариях нет.

После ошибки UI сохраняются `failure.png` и `trace.zip`. Отчёт можно открыть
командой `npx playwright show-report`, трассу — `npx playwright show-trace <путь>`.

Фикстура рассчитана на macOS и Linux с bash. На Linux без графической сессии
используйте `xvfb-run -a npm run test:e2e`; Windows пока пропускается явно.
В среде, запрещающей запуск окон Electron, тесты завершаются ошибкой запуска.
Для диагностики: `DEBUG=pw:browser npx playwright test`.

`npm run build:e2e` собирает приложение без установщика. Обычный `npm run build`
также создаёт установщик через electron-builder; на macOS для этого требуется
работающий `hdiutil`.

Проверки без GUI:

```sh
CI=true npx vitest run
npx tsc --noEmit
npx tsc --noEmit -p e2e/tsconfig.json
npm run lint
```

Если песочница запрещает системную временную папку, задайте `TMPDIR` внутри
проекта перед запуском инструментов, например:

```sh
mkdir -p .task-e2e-audit/tmp
TMPDIR="$PWD/.task-e2e-audit/tmp" CI=true npx vitest run
```

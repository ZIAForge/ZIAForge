# Saved data and recovery

Settings, presets, registered projects, per-project task indexes, executable plans and structured session metadata use validated JSON documents. Missing settings may use defaults. Invalid JSON or invalid known fields never trigger an automatic reset, task filtering, or registration reconstructed from directory names.

Each successful write atomically publishes a private file and keeps up to eight validated content-addressed revisions beside it in `<filename>.recovery/`. The writer synchronizes file content and the containing directory. Legacy files acquire backups when next saved; an untouched old file may have no backup. Backup timestamps help identify revisions, but the SHA-256 content identity is the authority. Unknown historical metadata fields are preserved; current known fields and project/task identity are validated.

When corruption is detected, the recovery panel identifies the affected document. Damaged core settings block execution and writes while the UI remains available. A damaged task index blocks that project; other valid projects remain readable. Choose a listed validated backup and use **Restore selected backup and reload**. Restoration compares the current damaged-file fingerprint with the inspected value and refuses stale requests. It preserves the exact damaged bytes in `<sha256>.damaged` before replacing the primary file. Damaged archives are never automatically deleted. There is no automatic choice of backup and no fallback to an empty task list on disk.

If no valid backup exists, preserve the damaged file and obtain a known good copy before changing it. Oversized files, symlinks, permission/I/O errors and unsafe directory layouts fail closed; the app does not bypass those conditions. Restoring project/task ownership indexes requires a fresh app session before any task processes have launched, so no existing task is orphaned or killed by recovery.

Writes publish a complete owner record in a monotonically increasing lock generation. After a crash, the next writer verifies that the recorded process is gone (or its PID now belongs to a different process) and claims the next generation without deleting the stale owner's lock. Concurrent reclaimers contend on one atomic publication; a live or unverifiable owner blocks writes. Eight recent generations are retained, including the newest. The unreleased development prototype's ownerless `write.lock` cannot establish ownership and is refused explicitly; released 0.0.3 builds predate that prototype. Unknown legacy locks require inspection with old app instances closed; backup and damaged archives must remain untouched. Locking serializes writers but does not merge independently edited documents; callers can use the fingerprint comparison for reviewed edits.

The renderer can name only logical domains plus registered repository/task IDs and validated run IDs. It cannot supply arbitrary recovery paths. Workflow restoration is serialized with workflow commands, rejects an active engine, and discards cached state only after successful recovery. A restored interrupted workflow requires explicit continuation; a backup is not permission to repeat a model prompt or Git operation.

Session metadata is backed up when the run is created. A damaged or missing record with existing journal/provider evidence never means a new empty conversation; ambiguous ownership blocks loading for the task rather than rolling back to an older run. Restore a chosen session backup in a fresh application before opening other sessions. The existing native reference and event journal remain in place, and resuming or sending still requires an explicit action. Legacy metadata without a validated backup needs a known good external copy; the app does not invent lost identity.

Agent event journals remain append-only. A torn final line is preserved and separated before the next append; replay skips malformed JSON lines. This tolerance is distinct from metadata restoration: it can omit the damaged event, and append completion alone does not guarantee power-loss durability. Keep the original journal for diagnosis. This release does not claim journal correction or reconstruction of missing content.

Run targeted regression checks without real models:

```sh
npx vitest run electron/runtime/__tests__/RecoveryStore.test.ts electron/runtime/__tests__/StoredMetadataValidation.test.ts src/components/__tests__/RecoveryPanel.test.tsx
npx playwright test e2e/recovery.spec.ts
```

The Electron test requires a fresh compiled application and creates an isolated profile. It damages only its fixture settings or session metadata, verifies execution is blocked, restores a chosen backup through the visible UI and checks that the exact damaged bytes remain archived. The session case also checks retained history and draft, native context, and no prompt delivery before explicit Resume and Send. Standard fixture teardown verifies normal Quit and owned-process cleanup.

For bounded backend resource evidence, `SessionManager.scalability.test.ts` uses 50 tasks with two chats each, 200 turns, eight chunks per reply and at most four simultaneously active in-memory adapters. It checks identity isolation, history, idle-session preservation, shutdown and replay without respawning. Set `ZIAFORGE_SCALE_RECEIPT` to a new absolute output filename to retain its JSON measurements. The command refuses to overwrite existing evidence:

```sh
ZIAFORGE_SCALE_RECEIPT="$PWD/test-results/sessions-100-new.json" npx vitest run electron/runtime/__tests__/SessionManager.scalability.test.ts
```

These measurements cover the backend coordinator, not the Electron renderer, hundreds of native CLI processes or network/model throughput. Worker memory includes the test harness without forced garbage collection, and replay benefits from the OS filesystem cache. Do not convert a local passing resource test into a hardware-independent capacity guarantee.

# Key mapping integration

## Architecture research

The existing application uses Expo SDK 57, React Native 0.86, Expo Router, and a custom `jetsona-input` native module on Android/iOS. Streaming remains in `useStreamSession` and `NativeMoonlightClient`; mapping does not open a connection or modify video/audio negotiation.

| Existing source | Integration point |
| --- | --- |
| `src/features/settings/ConsoleSettings.tsx` | Existing settings categories, navigation, and glass presentation; now includes **Thiết lập nút**. |
| `src/features/library/usePcLibrary.ts`, `types.ts` | Existing PC game library and stable game IDs, titles, and artwork. |
| `src/features/stream/GuideMenu.tsx` | Existing GuideMenu (called GuildMenu in the request); adds a mapping dock icon and uses its existing popover, animation, toast, and controller navigation. |
| `src/features/gamepad/guideButton.ts` | This checkout opens the menu using Select alone. That behavior is preserved; Start + Select also opens it. Neither control is available as a mapping trigger. The combined Start bit is suppressed from remote forwarding. |
| `modules/jetsona-input/.../PadState.kt`, `ios/JetsonaInputModule.swift` | Supported face buttons, D-pad, bumpers, triggers, stick clicks, and signed stick axes. Stick Y is negative upward on both platforms. |
| `src/features/stream/useInputBridge.ts` | Physical controller state enters the runtime before native controller forwarding. All periodic/resend paths filter assigned inputs too. |
| `src/lib/moonlight-native.ts`, `controller-protocol.ts` | Existing reliable mouse position/button packets and controller packets. Coordinates are already encoded against a normalized 4096-unit remote surface. |
| `src/features/stream/StreamTouchpad.ts`, `src/lib/stream-fit.ts` | Existing pointer input and viewport geometry. Manual mouse/touch input cancels queued mappings before taking control of the pointer. |
| `src/lib/supabase.ts`, `src/features/auth.tsx` | Shared singleton Supabase client, authenticated user ID, and persisted auth session. No new client, credentials, or database backend. |
| Shared `supabase/migrations/` | Existing snake_case schema, owner-scoped RLS patterns, and Storage bucket configuration. Existing avatar/UI-media buckets are public and inappropriate for private gameplay screenshots. |
| `src/lib/game-screenshots.ts` | Existing screenshots are saved to the PC's local storage, not a private Supabase bucket. That feature is preserved. Mapping uses its own private bucket within the existing Supabase service. |
| `src/ui/Press.tsx`, `GlassMaterial.tsx`, `Img.tsx`, `Text.tsx`, `src/theme/` | Existing interaction sounds, focus behavior, glass surfaces, typography, and theme tokens. |
| `src/features/sound/UiSoundProvider.tsx` | Selection, confirmation, back/error, and transition feedback respecting the existing mute/volume settings. Macro execution is silent. |
| Existing `src/lib/__tests__/` | Node test runner, native/network boundary mocks, lifecycle tests, and protocol verification patterns reused for mapping tests. |

The PC agent's existing `/games/runtime` endpoint reports foreground game identity and paused state (`deploy/pc/agent.ps1`). Activation verifies it. While gameplay mapping is active, a serial poll every three seconds disables mapping if the foreground game changes or cannot be verified. This is separate from the input path; mapped events never request Supabase or the PC HTTP API.

## Implemented workflow

1. Open Settings → **Thiết lập nút**. Select an existing library game and choose **Tạo mới**.
2. Choose a full-frame PNG/JPEG/WebP screenshot from existing Storage (Cloud or PC) or the device photo library, preview it, and confirm. The Storage browser opens `Images`, supports folders/root navigation, and links to PC game screenshots. Storage reads/downloads use the existing authenticated API. Images are limited to 10 MB, with binary signature and geometry validation before selection and saving.
3. Drag a supported control onto the screenshot, or tap a palette control to place it centrally. Drag existing markers to move them; tap one to open its contextual action editor.
4. Configure tap, fixed/physical hold, double tap, fixed delay, random timing, swipe, or a combination of up to four physical controls. A macro is a named ordered list of these steps, with add/remove/reorder and per-step coordinates/timing.
5. Use zoom/pan, reset-to-center, undo/redo, marker visibility/opacity, and on-image placement of macro/gesture coordinates. Replacing the screenshot clears positional undo history so image geometry and history cannot diverge. Unsaved navigation prompts protect edits; saving locks the editor until the server responds.
6. Name the profile and save. Only a confirmed Supabase write produces a success message. Settings supports reopening, renaming via the editor, deleting, and duplicating profiles; returning from the editor refreshes the list.
7. During streaming, open GuideMenu and select its mapping icon. Select a profile for the current foreground game. Selecting the active profile presents exactly **Tắt mapping** and **Chỉnh sửa mapping** as its primary actions.

Opening the editor from GuideMenu disables mapping first and keeps the existing stream mounted. A saved edit must be activated explicitly. Editing controls never mutate a running profile; activation takes an independent snapshot.

## Runtime behavior and limits

- The current protocol supports one remote mouse pointer. Taps, holds and swipes are mouse equivalents, with positions and button transitions on the same existing reliable channel. Simultaneous multi-touch is not implemented. Mapping jobs run sequentially to prevent interleaved pointer ownership; a long delay/macro can defer other queued mappings.
- Unassigned controller inputs retain native behavior. Inputs participating in a binding, including combo modifiers, are reserved for mapping while the profile is active. Face-button mappings use physical/native identity before the optional Nintendo layout conversion.
- Chords prefer the largest matching control set, then binding ID for ties. A 60 ms window lets a chord suppress its single-button binding. A button remaining held after a chord releases does not trigger a new single action. Fast individual taps within that window are retained.
- Trigger/stick directions activate at magnitude 0.55. These are directional button triggers, not continuous virtual touch joysticks. Start, Select, Guide, paddles and touchpads are excluded from the palette.
- Limits: 64 bindings/profile, 32 steps/binding, 1–20 repeats, five minutes of configured execution per binding, 60 seconds per timed step, and 32 queued/running jobs. Physical hold has a 60-second safety cap. Queue overload stops mapping with feedback. No infinite-repeat mode exists.
- Random delay is chosen anew per execution and affects timing only. All waits and gesture motion yield to the event loop; no UI state updates occur for individual macro steps.
- Disable, switch, menu opening, editor navigation, controller disconnection, app inactivity, session/client replacement, geometry mismatch, manual pointer input, and execution errors cancel relevant work. Held pointer input is released synchronously where a healthy channel remains available. App inactivity cleanup subscribes before the stream's background shutdown handler.
- Input readiness is checked before each mapped pointer dispatch. A disconnected channel cannot retain scheduled mapping packets for later replay. The host's normal disconnect handling remains responsible for releasing input after a transport has already failed.
- Screenshot coordinates remain normalized. The editor inverts its own contain/letterbox, zoom and pan transforms. Runtime positions address the remote frame directly, independent of device orientation, viewport bars and viewer scaling. Screenshot/stream aspect ratios must agree within 1%; a changed ratio disables mapping. Use un-cropped full stream screenshots. Changes to a game's internal UI layout cannot be inferred from geometry alone.

## Supabase persistence and security

Device library access is requested only after selecting **Thư viện thiết bị**. Android 12 and older request legacy read access, Android 13 requests image access, and Android 14+ also accepts selected-photo access. iOS accepts full or limited library permission. Permanently denied access offers a Settings link; denial/cancellation does not replace the current screenshot. Storage selection never requests device gallery permissions. Android image/selected-photo declarations require rebuilding the client. Downloaded Storage images are copied into app cache and then uploaded to the profile's private Supabase bucket on save; cancel/replacement/editor disposal cleans up owned cache files without deleting the original Storage file or device photo.

The mobile repository now includes its required migration:

`supabase/migrations/202610220001_key_mapping_profiles.sql`

The original shared migration is also at `../supabase/migrations/202610220001_key_mapping_profiles.sql`. The mobile copy can be reapplied safely to either a new or already configured database and explicitly refreshes the PostgREST schema cache.

If Settings reports that `public.key_mapping_profiles` cannot be found (`PGRST205`), install the schema on the existing self-hosted Supabase server. From this mobile repository, run in PowerShell using a server administration SSH key:

```powershell
.\scripts\apply-key-mapping-migration.ps1
```

The script finds the documented `dathuynh` administration key in the user's SSH/OneDrive folders, or accepts `-KeyPath` (and `JETSONA_VM_KEY`). It verifies the server against the public address already pinned in `C:\jetsona\keys\known_hosts`; it does not change key permissions. The dedicated `jetsona_pc_tunnel` key cannot run SQL: its forced command prints `tunnel-only` and can exit successfully. An SSH exit code alone therefore does not prove deployment. The script now requires a unique PostgreSQL receipt after all checks and COMMIT, and treats `tunnel-only`, missing receipts and nonzero exits as failures.

It applies only this migration and checks the table, role grants, ownership policies and private screenshot bucket inside the transaction. For another deployment, pass `-Server`, `-KeyPath`, `-KnownHostsPath` and `-HostKeyAlias` explicitly. Then select **Tải lại profile** in the app. Applying SQL alone does not require a native rebuild.

The app surfaces missing-schema errors as an unavailable server feature, keeps genuine load failures distinct from an empty profile list, and disables **Tạo mới** until profiles load successfully. It never silently falls back to device storage.

It creates `public.key_mapping_profiles`, an owner/game index, ownership policies for all four operations, immutable identity/server timestamps, and a private `key-mapping-screenshots` Storage bucket. Objects are named `<user-id>/<profile-id>/<object-id>.<extension>`. Storage SELECT/INSERT/DELETE policies scope access to the authenticated user's folder; object replacement uses immutable new paths. Screenshots use expiring signed URLs, never public URLs.

The repository scopes every query to the signed-in owner and rechecks the existing auth session. Updates/deletes compare `updated_at`, preventing silent overwrites from another device. Duplicate profiles get independent row IDs and copied screenshot objects. Data is cached in memory for 30 seconds and refreshed at relevant UI entry points; there is no second persistent profile store or automatic profile activation after restart.

Uploads precede database writes. Failed writes verify whether the uploaded path is referenced before cleanup, including a server commit whose response was lost. Existing screenshots are removed only after replacement commits; profile deletion removes its screenshot after the row is deleted. If connectivity prevents cleanup, the UI reports a warning. Interrupted clients or repeated cleanup failures can leave unreferenced Storage objects requiring a later administrative cleanup; there is no deployed background garbage collector.

## Files changed for this feature

| File | Purpose |
| --- | --- |
| `app.json`, `package.json`, `package-lock.json` | SDK-compatible image picker, file reader and UUID generator; photo picker configuration without camera/microphone permissions. |
| `src/app/button-mapping.tsx`, `button-mapping-editor.tsx` | Expo Router entry screens; non-route logic remains outside `src/app`. |
| `src/features/key-mapping/model.ts` | Versioned types, supported physical controls, geometry and data/image validation. |
| `src/features/key-mapping/runtime.ts` | Cancellable resolver, scheduler, gesture/macro execution, pointer ownership, and existing-connection adapter. |
| `src/features/key-mapping/repository.ts`, `service.ts` | Owner-scoped Supabase CRUD, private screenshots, optimistic concurrency, memory cache, upload compensation, and duplication. |
| `src/features/key-mapping/active.ts`, `useMappingRuntime.ts` | In-memory active status and stream/auth/controller/app/game lifecycle integration. |
| `src/features/key-mapping/MappingLibrary.tsx`, `MappingUi.tsx` | Existing game selection, profile management, and shared themed/glass UI controls. |
| `src/features/key-mapping/MappingEditor.tsx`, `ActionEditor.tsx` | Screenshot canvas, drag/drop, history, image preview, contextual actions, combos, and macro editing. |
| `src/features/key-mapping/ScreenshotPicker.tsx`, `storage-images.ts`, `screenshot-sources.ts`, `photo-permissions.ts` | Existing Storage Cloud/PC browsing and authenticated downloads; device-library permission handling, confirmation, validation, and owned cache cleanup. |
| `src/lib/game-screenshots.ts` | Optional Cloud/PC preview source while preserving existing PC screenshot callers. |
| `src/features/key-mapping/MappingProfilesPanel.tsx` | GuideMenu profile list, activation compatibility checks, Disable/Edit actions, native controller navigation, and feedback. |
| `src/features/settings/ConsoleSettings.tsx` | Settings integration. |
| `src/features/stream/GuideMenu.tsx`, `StreamScreen.tsx` | Existing menu integration, session ownership, editor focus isolation, and runtime wiring. |
| `src/features/stream/useInputBridge.ts`, `StreamTouchpad.ts` | Mapping input interception, filtered native resends, reserved controls and manual pointer cancellation. |
| `src/lib/moonlight-native.ts` | Live pointer-channel readiness check; existing input protocol unchanged. |
| `src/lib/__tests__/key-mapping-fixture.ts` | Shared test data. |
| `src/lib/__tests__/key-mapping-runtime.test.ts` | Action execution, macros, chords, geometry, validation, cancellation, release, and native filtering. |
| `src/lib/__tests__/key-mapping-repository.test.ts` | Save/load/rename/delete/duplicate, binary upload, ownership/session checks, private image errors and partial/ambiguous failures. |
| `src/lib/__tests__/key-mapping-input-pipeline.test.ts` | Real controller bridge → runtime → real Moonlight packet encoding/channel dispatch, reserved shortcut and dropped-channel protection. |
| `src/lib/__tests__/key-mapping-guide.test.ts` | Actual profile panel's load/activate/disable/edit behavior, controller confirmation, and failure feedback with controlled external boundaries. |
| `src/lib/__tests__/key-mapping-photo-permissions.test.ts`, `key-mapping-storage-images.test.ts`, `key-mapping-screenshot-sources.test.ts` | Android/iOS full/limited/denied permissions, source isolation, safe Storage browsing, binary downloads, cancel/confirmation preparation and cache ownership. |
| Shared Supabase migration above | Database schema, timestamp trigger, RLS policies, private bucket and Storage policies. |
| `KEY_MAPPING.md` | Research, integration details, changed files, verification and release checklist. |

Concurrent changes to `ConsoleScreen.tsx`, `LibraryHeader.tsx`, and the newly added `VirtualKeyboard.tsx` were present during this work and were not edited as part of mapping.

## Verification

- Missing-schema fix: lint and typecheck passed; all **218 tests** passed, including missing-table error handling, cache invalidation, recovery after server setup and deployment receipts. A live audit on 2026-10-22 confirmed the table, all 13 columns, RLS, CRUD grants, timestamp trigger, seven ownership policies and private 10 MB screenshot bucket. The VN public API recognizes the table and denies guest access with `42501`, rather than missing-table `PGRST205`. An authenticated database transaction verified owner create/read/update/delete and blocked another identity's read/update/delete/forged insert; all verification changes rolled back. No actual mapping image upload or device interaction was performed by this audit. The CN API could not be checked because this machine's DNS returned `ENOTFOUND` for `cn.protexa.cloud`.
- Deployment regression coverage now includes an SSH server that returns `tunnel-only` with exit 0, empty/wrong receipts, successful PostgreSQL verification, and a nonzero exit despite a receipt. Only the successful PostgreSQL case may report database setup verified.
- `npx.cmd tsc --noEmit`: passed.
- `npx.cmd expo lint src`: passed on the updated workspace, including the source picker and photo permissions.
- Full project test command (`npm.cmd test`): **218 passed, 0 failed**. Mapping, deployment verification, existing streaming, geometry, controller protocol, lifecycle, dependencies and UI navigation tests passed.
- Android and iOS production exports with Hermes bytecode: passed. The initial Android attempt failed because the Windows sandbox denied Hermes's temporary output; using a task-local workspace temp directory resolved it.
- Protocol verification confirms normalized absolute coordinates and mouse down/up reach the real existing reliable channel sender, while unassigned controller buttons retain their native packet bits. This uses a controlled data-channel boundary, not a live remote host.
- Supabase save/load and ownership/error handling were tested against a controlled repository boundary. Live table RLS was exercised by the audit above; Storage ownership policies were inspected. Actual Storage uploads and authorization tests through the Storage API remain required.
- GuideMenu activation/deactivation/edit logic was tested with controlled Supabase and PC-game responses. Runtime release/cancellation and packet dispatch are executed in these tests.
- No Android device/emulator was connected. Native drag/drop, image picking, visual layout, iOS device behavior, and actual in-game responses still require device testing. No live save/load or restart-persistence claim is made.

## Release checks still required

1. The current server's schema and table RLS are verified. Apply the mobile Supabase migration when deploying another environment. Verify with two signed-in accounts through the app/Storage API that profile rows and private screenshot objects cannot be accessed across owners.
2. Build/install an updated development or production client: the added native Expo modules require a new binary. An OTA update alone is insufficient for an older installed client.
3. On Android and iOS, create a profile from a real full-frame game screenshot, save, restart the app, reopen/rename/duplicate/delete it, and verify private image retrieval and replacement cleanup.
4. In a real remote game, verify tap/hold/double/delay/random/swipe/chord/macro timing and coordinate alignment at supported resolutions, including viewport bars and zoomed editor placement.
5. Verify GuideMenu's reserved shortcut and Disable/Edit popup, profile switching, controller removal, app backgrounding, network loss, host foreground changes and held-input release. Check UI sound mute/volume and native behavior after disabling.

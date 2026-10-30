# Orbit Mobile — agent rules

React Native app for Orbit (team chat). Talks to `apps/server` over HTTP; mirrors the look of `apps/web`.

Orbit is a replica of Slack. When a feature, screen, flow, or interaction isn't specified, take inspiration from how the Slack mobile app does it (layout, navigation, naming, admin/permission behavior).

These versions are newer than most training data (RN 0.88, React 19.3, React Navigation 7, Reanimated 4, Zustand 5). Check the installed package's types/docs in `node_modules/<pkg>` before using an API from memory, and heed deprecation warnings.

# Architecture & code standards

- **Feature-based architecture.** Code lives under `src/features/<feature-name>/`, not grouped by technical type. Each feature owns its `screens/`, `components/`, `hooks/`, `services/`, `store.ts`, and `types.ts` as needed (see `src/features/auth/` for the reference shape). Shared/cross-feature code goes in a common location, not duplicated per feature.
  - Inside a feature, import its own files relatively (`../store`); import other features and shared code via `@/` (`@/features/auth/store`, `@/lib/api`).
- **Reusable & scalable.** Before writing new logic, check if it already exists (a hook, util, store, type, UI primitive) and reuse or extend it. Don't hardcode what will plausibly need to vary; don't over-abstract what won't.
- **Cover edge cases.** For every change, explicitly consider: empty/null/undefined input, loading and error states, offline / server unreachable / timeout, 401 (session expired), boundary values (0, very long text, duplicates), double taps on submit, and state updates after the screen unmounted or the app was backgrounded. Don't skip error handling to keep a diff small.
- **Both platforms.** Every UI change must work on iOS and Android. Use `Platform.select` / `Platform.OS` for real differences only (keyboard behavior, emulator host, shadows).

# Stack

- React Native 0.88 (bare CLI, not Expo) + React 19 + TypeScript (strict via `@react-native/typescript-config`).
- Navigation: `@react-navigation/native` + `native-stack`. Route params are typed in `src/navigation/types.ts` (`RootStackParamList`, `ScreenProps<'Name'>`) — add every new screen there.
- State: Zustand. Read with selectors (`useAuthStore((s) => s.user)`), never destructure the whole store (causes re-renders on every change).
- HTTP: the single axios instance `api` from `@/lib/api` (base URL, 15s timeout, bearer token, 401 → logout already wired). Never create another axios instance or call `fetch` to the server directly. Turn errors into user text with `getErrorMessage(err, fallback)` — the server returns `{ error: string }` on failure.
- Message text: stored as **markdown** (same as web). The composer is `react-native-enriched-html`'s `EnrichedTextInput` (WYSIWYG, native; emits HTML), converted with `features/chat/htmlToMarkdown.ts` before sending; messages render with `react-native-markdown-display` (`MarkdownText`). Don't hand-roll editors or markdown parsers. `react-native-enriched-html` is pinned to a **nightly** (1.2.x) because stable 1.1.x only supports RN ≤ 0.86; move to the stable 1.2 release when it ships.
- Realtime: the single socket.io connection in `@/lib/socket` (opened per workspace by `useRealtime`, mounted in `MainTabs`). Never open another; use the `EVENTS` names there (runtime values can't come from `@orbit/types`).
- Server URL: `@/lib/config` (`SERVER_URL`; dev uses `localhost` everywhere; on Android run `adb reverse tcp:4000 tcp:4000` after each connect/reboot).
- Styling: NativeWind v4 (`className` on RN components) with a **Tailwind v3** config (`tailwind.config.js`) — use v3 syntax, not v4. Merge classes with `cn()` from `@/lib/utils`. Use theme tokens (`slack.*`, `primary`, `muted`, …) instead of raw hex. The theme mirrors `apps/web/tailwind.config.js` and `global.css` mirrors web's `globals.css` — change both sides together. The app is dark-only for now.
- UI primitives: shadcn-style react-native-reusables in `@/components/ui/*` (`@rn-primitives/*` + `class-variance-authority` + `tailwind-merge`). Reuse/extend these instead of one-off styled elements or a new UI library. Render text with `Text` from `@/components/ui/text` (not RN's `Text`) so `Button` variants can style it.
- Lists: `@shopify/flash-list` for anything long or unbounded (messages, channels, members). Never `ScrollView` + `.map()` over server data.
- Animation: Reanimated 4 / Worklets. The Babel plugin comes from `nativewind/babel` — don't add it again in `babel.config.js`.
- Safe areas: `react-native-safe-area-context` (`SafeAreaView`/`useSafeAreaInsets`), not RN's deprecated `SafeAreaView`.
- Path alias: `@/*` → `src/*` (set in both `tsconfig.json` and `babel.config.js` — keep them in sync).

# Shared types (`@orbit/types`)

- Types shared with server/web (`UserProfile`, `AuthTokens`, …) live in `packages/types/src` and are imported as `import type { X } from '@orbit/types'`.
- **Type-only imports.** Metro/Babel don't resolve `@orbit/types` (only `tsconfig` does), so a value import (enum, const, function) compiles but crashes at runtime. Need a shared runtime value? Ask first.
- Don't redeclare API shapes locally that already exist there; feature-only UI types go in that feature's `types.ts`.

# Security

- Auth token lives only in Keychain/Keystore via `react-native-keychain` (see `src/features/auth/store.ts`). Never put tokens or user secrets in AsyncStorage, MMKV, logs, or component state that gets persisted.
- Everything in the JS bundle is public. No API keys, secrets, or private URLs in source; anything config-like goes in `src/lib/config.ts` and must be safe to ship.
- Never log tokens, passwords, or full API responses containing user data.

# Project layout

- `App.tsx` — providers + root navigator only. Auth gating swaps screen sets on `user` (React Navigation's auth pattern): never call `navigate()` after login/logout.
- `src/features/<name>/` — one folder per feature (`auth`, `admin`, `workspaces`, `chat`, `dms`, `profile`, …). API calls for a feature go in its `services/` (e.g. `features/auth/services/authApi.ts`), not in screens.
- `src/components/` — cross-feature UI only (`ui/*` primitives, layouts used by 2+ features).
- `src/lib/` — cross-cutting singletons/utilities (`api`, `config`, `utils`). Not feature logic.
- `src/navigation/` — navigator param types and (later) nested navigators.
- `__tests__/` — Jest tests.
- `ios/`, `android/` — native projects. Don't edit unless the task is native; never commit `ios/Pods` or build output.

# Conventions

- Named exports for components/screens (`export function LoginScreen`). One screen per file, named `<Name>Screen.tsx`.
- Keep screens thin: UI + wiring. API calls and non-trivial logic go in the feature's `services/` or store, as plain functions that are easy to test.
- Async handlers: guard against double submit (`if (isLoading) return`), validate input before calling the API, and always reset loading state on failure.
- Forms: set `autoComplete`, `textContentType`, `keyboardType`, `returnKeyType`, and chain focus with `onSubmitEditing` (see `LoginScreen.tsx`).
- Touch targets: at least ~44pt; use `hitSlop` on small `Pressable`s. Give icon-only buttons an `accessibilityLabel`.
- Formatting: Prettier (`singleQuote`, `trailingComma: 'all'`, `arrowParens: 'avoid'`), ESLint `@react-native`.
- Comments explain *why*, not what. Mark deliberate shortcuts with `// ponytail: <limit>, <upgrade path>`.

# Dependencies

- This app is **not** in the root npm workspaces. Run `npm install` inside `apps/mobile`.
- Prefer what's already installed. Adding a package with native code requires `cd ios && bundle exec pod install` plus a full rebuild on both platforms — ask before adding one, and say so in your summary.
- Check a new library supports RN's New Architecture and the installed RN version.

# Commands & verification

Run from `apps/mobile`:

- `npm start` — Metro. `npm run ios` / `npm run android` — build + run.
- `npm run lint`, `npx tsc --noEmit`, and `npm test` must pass before a change is done.
- Jest only transforms the packages listed in `transformIgnorePatterns` (`jest.config.js`). If a new dependency fails with `Unexpected token 'export'` or `'<'`, add it there; CSS imports are stubbed via `__mocks__/styleMock.js`.
- Tests: Jest with `@react-native/jest-preset`. Put non-trivial logic (parsing, formatting, store transitions) in plain functions and add a test in `__tests__/`; mock native modules the way `authStore.test.ts` mocks `react-native-keychain` and stubs the axios adapter.
- UI changes: run on at least one iOS simulator and one Android emulator, including the loading, error, and offline states.

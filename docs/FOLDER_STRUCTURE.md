# Asanamanager – Folder Structure (Professional / Industrial)

State management **lazmi** use hota hai (Zustand). Sab feature isi structure ke andar add karein.

---

## Root

```
ProjectApp/
├── database/           # SQL schema & migrations
├── docs/               # Architecture, folder structure
├── scripts/            # DB init, schema run
├── src/
├── public/
├── .env
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## `src/` (Core)

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Route group: login, signup (no sidebar)
│   │   ├── login/
│   │   └── signup/
│   ├── (dashboard)/        # Route group: protected, with sidebar
│   │   ├── page.tsx        # Dashboard home
│   │   ├── projects/
│   │   └── tasks/
│   ├── api/                # API routes (backend)
│   │   ├── auth/
│   │   ├── health/
│   │   ├── users/
│   │   ├── projects/
│   │   └── tasks/
│   ├── layout.tsx          # Root layout (Header, AuthHydrate)
│   ├── page.tsx            # Public home
│   └── globals.css
│
├── components/
│   ├── ui/                 # Reusable primitives (Button, Input, Card)
│   ├── layout/             # Header, Sidebar, Footer
│   ├── features/           # Feature-specific (TaskCard, ProjectCard)
│   ├── providers/          # AuthHydrate, etc.
│   └── index.ts            # Re-exports
│
├── store/                  # State management (Zustand – lazmi)
│   ├── slices/
│   │   ├── authSlice.ts
│   │   ├── projectSlice.ts
│   │   ├── taskSlice.ts
│   │   └── uiSlice.ts
│   └── index.ts            # Re-exports
│
├── services/               # API client & domain services
│   ├── api.ts              # Base fetch, auth header
│   ├── authService.ts
│   ├── projectService.ts
│   └── taskService.ts
│
├── hooks/                  # Custom hooks (useAuth, useProjects)
│   ├── useAuth.ts
│   ├── useProjects.ts
│   └── index.ts
│
├── types/                  # Shared TypeScript types
│   └── index.ts
│
├── constants/              # Routes, API paths, storage keys
│   └── index.ts
│
├── config/                 # Env, app config
│   └── env.ts
│
└── lib/                    # DB, utils (server-side)
    └── db.ts
```

---

## Conventions

| Layer        | Use for |
|-------------|---------|
| **store/**  | Global UI + domain state (auth, projects, tasks, view mode). **Lazmi** – state management yahi se. |
| **services/** | API calls; return typed data. No React. |
| **hooks/**  | React hooks that use store + services (e.g. fetch on mount). |
| **components/ui/** | Dumb UI (Button, Input). No API. |
| **components/features/** | Feature components (TaskCard) – can use store/hooks. |
| **components/layout/** | Header, Sidebar – use store for user/view. |
| **app/api/** | Backend; use `lib/db.ts` and return JSON. |
| **types/**  | Single source of truth for domain & API types. |
| **constants/** | Routes, API paths, storage keys – no magic strings. |

---

## State Management (Zustand)

- **authSlice**: user, token, logout, setAuth, isHydrated
- **projectSlice**: currentProject, projects, sections, set/update/add
- **taskSlice**: tasks, selectedTaskId, set/update/add/remove
- **uiSlice**: sidebarOpen, viewMode (list/board/timeline/calendar)

Import from `@/store` (e.g. `useAuthStore`, `useProjectStore`). No Redux boilerplate; Zustand use kiya gaya hai.

---

## Adding a New Feature

1. **Types**: Add in `src/types/index.ts`.
2. **API**: Add route under `src/app/api/<resource>/`.
3. **Service**: Add `src/services/<resource>Service.ts` (apiGet, apiPost, …).
4. **Store**: Add or extend slice in `src/store/slices/`.
5. **Hooks**: Add `src/hooks/use<Feature>.ts` if needed.
6. **UI**: Add component in `components/features/` or `components/ui/`.
7. **Page**: Add under `app/(dashboard)/` or `app/(auth)/`.

Isi order mein kaam karein taaki structure consistent rahe.

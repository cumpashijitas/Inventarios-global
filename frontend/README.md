# Frontend — Inventario SaaS

React 18 + Vite + TypeScript + Tailwind + shadcn/ui + TanStack Query + Zustand.

## Setup

```bash
cd frontend
npm install
cp .env.example .env
# editar .env si tu backend corre en otra URL
npm run dev
```

App en <http://localhost:5173>. El backend debe estar corriendo en `VITE_API_URL` (default `http://localhost:8000/api/v1`).

## Comandos

```bash
npm run dev          # dev server con HMR
npm run build        # build de producción
npm run preview      # preview del build
npm run lint         # eslint
npm run typecheck    # tsc sin emitir
npm run format       # prettier
```

## Estructura

```
src/
├── main.tsx
├── index.css                  # variables shadcn
├── app/
│   ├── App.tsx
│   ├── router.tsx             # routing con lazy loading + ProtectedRoute
│   ├── providers.tsx          # QueryClient + Toaster
│   └── layouts/
│       ├── AppShell.tsx       # sidebar + topbar + outlet
│       └── AuthLayout.tsx
├── shared/
│   ├── api/                   # axios client + interceptors
│   ├── components/ui/         # primitivos shadcn (Button, Input, Dialog, ...)
│   ├── components/            # compuestos (DataTable, EmptyState, ...)
│   ├── hooks/
│   ├── lib/                   # cn(), formatters
│   ├── stores/                # Zustand (auth)
│   └── types/
└── modules/
    ├── auth/                  # Login + selector de empresa
    └── inventario/            # productos / almacenes / stock / movimientos
```

Reglas:
- Server state → TanStack Query (no Zustand). Zustand solo para UI/auth.
- Un módulo no importa de otro. Si necesitan algo común, sube a `shared/`.
- Componentes <200 líneas. Si crece, divide.

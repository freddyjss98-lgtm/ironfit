# Iron Fit Club — monorepo

- `apps/web` — Next.js (panel admin, portal del socio, API, cron y bot de WhatsApp). Desplegado en Vercel con Root Directory `apps/web`. Sus reglas: `apps/web/CLAUDE.md`.
- `apps/mobile` — app Expo (socio, coach y admin) para Android e iOS.
- `packages/shared` (`@ironfit/shared`) — TypeScript puro que usan las dos apps. Se importa como `@ironfit/shared/<módulo>` y se publica sin compilar. Aquí no puede entrar nada de Next ni de React Native.
- `supabase/` — migraciones y seed, compartidos por las dos apps.

Workspaces de npm: instala siempre desde la raíz (`npm install`) y lanza cada app con `-w` (`npm run dev -w @ironfit/web`).

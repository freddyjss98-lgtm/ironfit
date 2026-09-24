# Iron Fit Club

Monorepo de npm workspaces.

| Carpeta | Qué es |
|---|---|
| `apps/web` | Next.js: web, panel admin, portal del socio, API, cron y bot de WhatsApp |
| `apps/mobile` | App Expo para Android e iOS |
| `packages/shared` | Código TypeScript compartido (`@ironfit/shared`) |
| `supabase` | Migraciones y seed |

## Comandos

```bash
npm install            # siempre desde la raíz
npm run dev            # web en http://localhost:3000
npm run mobile         # servidor de Expo
npm run build          # build de la web
npm run typecheck      # todos los workspaces
```

Las variables de entorno de la web van en `apps/web/.env.local`.

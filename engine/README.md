# Engine

Az ajánlómotor backendja a projekt gyökérkönyvtárában található.

```
/src         → TypeScript forráskód
/data        → Termékkatalógusok (JSON + embeddings)
/scripts     → Import, backfill szkriptek
/dist        → Lefordított JS (npm run build)
```

## Indítás
```bash
npm run build
node dist/index.js   # port 3001
```

## API
- `POST /api/recommend` — ajánlások
- `POST /api/admin/*`   — admin műveletek
- `GET  /health`        — szerver állapot

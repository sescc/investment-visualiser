# server — architecture

`Loc`: Node `node:http` process bound to 127.0.0.1:5173. `Trm`: HTTP to the browser page.

| Morphism | Signature | Partiality / semantics |
| --- | --- | --- |
| serveStatic | path → file | only `/site/**` + the two data files; traversal rejected |
| hostIsAllowed | Request → bool | Host header check (DNS-rebinding guard) |
| refresh (`POST /api/refresh`) | {only?} → report | `only` allowlisted against adapter ids; one at a time, else 409 |
| health (`GET /api/health`) | → ok | presence enables the site's Refresh button |

# Copiloto Brío · Almena Foods

Copiloto de análisis para los analistas de Mercadeo de la marca Brío. Responde preguntas de ventas en lenguaje normal y conecta las cifras con los estudios internos de consumidor.

**Principio de diseño: la IA interpreta y redacta; la tabla validada calcula.** Ninguna cifra la calcula el modelo: sale de una herramienta, viaja con su ficha (fuente, corte, definición, responsable) y el servidor verifica que cada número del texto tenga respaldo.

**Pruébalo en línea:** https://copiloto-brio.calmwater-0e4a7472.eastus2.azurecontainerapps.io

> ⚠️ **Datos sintéticos.** La tabla de ventas y los estudios fueron creados para la prueba técnica de Ingeniero de Producto IA (caso ficticio Almena Foods). Las ventas netas de 2025 suman COP 36.000 M para cuadrar con el dato confirmado del caso.

## Qué demuestra

| Problema del caso | Cómo lo resuelve el prototipo |
|---|---|
| Tres reportes con definiciones distintas de ventas netas | Definición única (brutas − descuentos − devoluciones) y herramienta que cuantifica cuánto difiere cada reporte |
| "Un asistente que invente una cifra me quitaría credibilidad" | El modelo nunca calcula; un verificador del servidor marca cualquier cifra sin respaldo |
| La analista pide ver fuente, corte, definición y responsable | Ficha de trazabilidad en cada respuesta, construida desde el resultado de la herramienta |
| Cruzar ventas con investigaciones toma tiempo | Búsqueda en estudios internos con cita textual y sección |
| Medir valor en el piloto | Botones útil / tiene un error, registro auditable y batería de referencia |

## Levantar en local

Requisitos: [Bun](https://bun.sh) 1.2+ y una clave gratuita de Google Gemini (aistudio.google.com).

```bash
cp .env.example .env      # pega tu GEMINI_API_KEY
bun install
bun run dev               # http://localhost:3000
```

## Verificación sin modelo (0 diferencias)

```bash
bun run demo
```

Corre 18 preguntas de referencia contra las herramientas y las compara con valores calculados a mano en Python (`scripts/esperados.py` → `datos/bateria.json`). También prueba que el verificador detecta cifras inventadas. Es el criterio para salir al piloto.

## Prueba real con IA

```bash
bun run evaluar               # toda la batería por el copiloto completo (modelo + herramientas)
bun run evaluar C02 F03 E01   # solo algunas preguntas
```

Mide consulta correcta, exactitud de cifras, honestidad en preguntas fuera de alcance y cifras sin respaldo. Deja la evidencia en `out/evaluacion.md` y `out/evaluacion.json`.

## Canal Telegram (demostración)

El mismo copiloto atiende por Telegram (`src/canales/telegram.ts` solo traduce mensajes). **Es un canal de demostración con datos sintéticos; en producción el canal sería Microsoft Teams**, dentro del tenant corporativo.

| Variable | Uso |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Token de @BotFather. Sin él, el canal queda apagado |
| `TELEGRAM_USUARIOS` | IDs autorizados separados por coma (lista blanca) |
| `TELEGRAM_WEBHOOK_SECRET` + `PUBLIC_URL` | En Azure: webhook firmado. Sin ellos, polling local |

## Despliegue (GitHub Actions + Azure Container Apps)

Cada `push` a `main` verifica tipos, corre la batería sin modelo y publica la imagen en `ghcr.io/sergioguarin11/copiloto-brio`. La suscripción de prueba admite un solo entorno de Container Apps, por eso la app vive en su propio grupo (`rg-copiloto-brio`) sobre el entorno existente.

```bash
read -s K
az containerapp create -n copiloto-brio -g <grupo-de-recursos> \
  --environment <entorno-container-apps> \
  --image ghcr.io/sergioguarin11/copiloto-brio:latest \
  --ingress external --target-port 8080 --min-replicas 1 --max-replicas 1 \
  --secrets gemini-key="$K" \
  --env-vars GEMINI_API_KEY=secretref:gemini-key LLM_THINKING=low LLM_TIMEOUT_MS=90000
unset K
```

## Backlog (Azure DevOps)

`backlog/backlog.json` es la fuente única: 30 PBIs (6 del prototipo y 24 del plan de 90 días, con horas mín / probable / máx por área).

```bash
bun run backlog md        # regenera BACKLOG.md
bun run backlog cargar    # crea Épicas, Features y PBIs en Azure DevOps (requiere az devops configurado)
```

## API

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/chat` | `{ sessionId, message }` → `{ reply, toolCalls[], verificacion }` |
| `POST` | `/api/feedback` | `{ sessionId, indice, util, comentario }` |
| `GET` | `/api/sessions/:id` | Historial de la sesión |
| `GET` | `/api/ejemplos` | Preguntas de ejemplo |
| `GET` | `/api/health` | Estado del modelo y canales, sin exponer claves |

## Estructura

```
agent/prompt.md               comportamiento del copiloto
src/knowledge/                conocimiento y definiciones (definición única de ventas netas)
src/tools/brio.ts             herramientas: dimensiones, consultar_ventas, definicion, buscar_estudios
src/tools/lib/ventas.ts       cálculo y formato de cifras (sin modelo)
src/tools/lib/estudios.ts     búsqueda de fragmentos textuales en estudios
src/verificador.ts            control del servidor: cifras del texto vs resultados de herramientas
src/agent.ts                  ciclo del agente con topes
src/llm/                      adaptador propio + Gemini con rotación de modelos
src/server.ts                 API + front + webhook de Telegram
src/canales/telegram.ts       canal Telegram
web/index.html                chat web con ficha, verificación y retroalimentación
datos/                        tabla validada sintética, estudios sintéticos y batería de referencia
scripts/                      generación de datos, esperados, evaluación con IA y backlog
demo.ts                       verificación sin modelo
```

Base técnica reutilizada de [reto-01-guarin](https://github.com/Sergioguarin11/reto-01-guarin) (ciclo del agente, adaptador de modelo, servidor, canal Telegram y despliegue).

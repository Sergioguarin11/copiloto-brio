// Servidor HTTP (Bun): API del chat + front estático + retroalimentación + webhook de Telegram.
// La clave del modelo solo existe en variables de entorno de este proceso.
import { join } from "node:path"
import { ROOT, ID_VALIDO, llm, procesarMensaje, obtenerSesion, EJEMPLOS, registrarFeedback } from "./servicio.ts"
import { telegram } from "./canales/telegram.ts"

const PUERTO = Number(process.env.PORT) || 3000
const CLAVE_ACCESO = process.env.ACCESS_KEY ?? ""

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8" } })

const autorizado = (req: Request) => !CLAVE_ACCESO || req.headers.get("x-access-key") === CLAVE_ACCESO

async function leerCuerpo<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T
  } catch {
    return null
  }
}

async function manejar(req: Request): Promise<Response> {
  const p = new URL(req.url).pathname

  if (req.method === "GET" && (p === "/" || p === "/index.html")) {
    return new Response(Bun.file(join(ROOT, "web", "index.html")), { headers: { "Content-Type": "text/html; charset=utf-8" } })
  }
  if (req.method === "GET" && p === "/api/health") {
    return json({ ok: true, provider: llm?.proveedor ?? null, model: llm?.modelo ?? null, llm_configurado: !!llm, requiere_clave_acceso: !!CLAVE_ACCESO, telegram: telegram.estado() })
  }
  // Telegram firma cada llamada con su propio secreto; no usa la clave de acceso del chat web.
  if (req.method === "POST" && p === "/api/telegram/webhook") return telegram.webhook(req)

  if (!autorizado(req)) return json({ error: "Clave de acceso requerida" }, 401)

  if (req.method === "GET" && p === "/api/ejemplos") return json({ ejemplos: EJEMPLOS })

  if (req.method === "POST" && p === "/api/chat") {
    const body = await leerCuerpo<{ sessionId?: unknown; message?: unknown }>(req)
    if (!body) return json({ error: "El cuerpo debe ser JSON: { sessionId, message }" }, 400)
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : ""
    const message = typeof body.message === "string" ? body.message : ""
    const r = await procesarMensaje(sessionId, message)
    if ("rechazo" in r) return json({ error: r.rechazo }, r.estado)
    return json({ sessionId, ...r })
  }

  if (req.method === "POST" && p === "/api/feedback") {
    const b = await leerCuerpo<{ sessionId?: unknown; indice?: unknown; util?: unknown; comentario?: unknown }>(req)
    if (!b || typeof b.sessionId !== "string" || typeof b.util !== "boolean") return json({ error: "Se espera { sessionId, indice, util, comentario }" }, 400)
    const ok = await registrarFeedback(b.sessionId, Number(b.indice) || 0, b.util, typeof b.comentario === "string" ? b.comentario : "")
    return ok ? json({ ok: true }) : json({ error: "sessionId inválido" }, 400)
  }

  const mSesion = p.match(/^\/api\/sessions\/([A-Za-z0-9-]{8,64})$/)
  if (req.method === "GET" && mSesion && ID_VALIDO.test(mSesion[1] as string)) {
    const s = await obtenerSesion(mSesion[1] as string)
    return json({ id: s.id, creada: s.creada, tokens: s.tokens, historial: s.historial })
  }

  return json({ error: "No encontrado" }, 404)
}

Bun.serve({
  port: PUERTO,
  idleTimeout: 255, // los turnos con varias herramientas pueden tardar
  async fetch(req) {
    try {
      return await manejar(req)
    } catch (e) {
      console.error("[servidor]", e instanceof Error ? e.message : e)
      return json({ error: "Error interno del servidor" }, 500)
    }
  },
})

console.log(`Copiloto Brío en http://localhost:${PUERTO} · modelo: ${llm ? `${llm.proveedor}/${llm.modelo}` : "NO CONFIGURADO"}`)
await telegram.iniciar()

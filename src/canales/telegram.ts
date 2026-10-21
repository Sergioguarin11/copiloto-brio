// Canal Telegram: traduce mensajes de Telegram al servicio del copiloto (mismo ciclo, mismas herramientas).
// Modos:
//   - webhook: en producción (TELEGRAM_BOT_TOKEN + TELEGRAM_WEBHOOK_SECRET + PUBLIC_URL). Telegram llama a
//     /api/telegram/webhook y firma cada llamada con el secreto (header X-Telegram-Bot-Api-Secret-Token).
//   - polling: en local (solo TELEGRAM_BOT_TOKEN). El servidor consulta a Telegram; no necesita URL pública.
// Seguridad: TELEGRAM_USUARIOS limita quién puede usar el bot (IDs numéricos separados por coma).
// Telegram es canal de DEMOSTRACIÓN con datos sintéticos; en producción el canal sería Microsoft Teams.
import { procesarMensaje, EJEMPLOS, registrarFeedback } from "../servicio.ts"

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ""
const SECRETO = process.env.TELEGRAM_WEBHOOK_SECRET ?? ""
const URL_PUBLICA = (process.env.PUBLIC_URL ?? "").replace(/\/+$/, "")
const USUARIOS = (process.env.TELEGRAM_USUARIOS ?? "").split(",").map((s) => s.trim()).filter(Boolean)
const MODO: "webhook" | "polling" | "apagado" = !TOKEN ? "apagado" : URL_PUBLICA && SECRETO ? "webhook" : "polling"

type Usuario = { id: number; first_name?: string }
type Mensaje = { message_id: number; chat: { id: number }; from?: Usuario; text?: string }
type Update = { update_id: number; message?: Mensaje; callback_query?: { id: string; from: Usuario; data?: string; message?: Mensaje } }
type Boton = { text: string; callback_data: string }

const MENU = { ejemplos: "💡 Preguntas de ejemplo", nueva: "🔄 Nueva conversación", ayuda: "❓ ¿Qué puedes hacer?" }
const TECLADO_MENU = {
  keyboard: [[{ text: MENU.ejemplos }, { text: MENU.nueva }], [{ text: MENU.ayuda }]],
  resize_keyboard: true,
  is_persistent: true,
}

// ------------------------------------------------------------------ API de Telegram
async function api<T = unknown>(metodo: string, cuerpo: Record<string, unknown> | FormData): Promise<T | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${metodo}`, {
      method: "POST",
      ...(cuerpo instanceof FormData ? { body: cuerpo } : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) }),
    })
    const json = (await res.json()) as { ok: boolean; result?: T; description?: string; error_code?: number }
    if (!json.ok) {
      console.warn(`[telegram] ${metodo}: ${json.error_code} ${json.description ?? ""}`)
      if (json.error_code === 409) throw new Error("conflicto")
      return null
    }
    return json.result ?? null
  } catch (e) {
    if (e instanceof Error && e.message === "conflicto") throw e
    console.warn(`[telegram] ${metodo}: sin conexión`) // nunca se registra el token
    return null
  }
}

const enviarTexto = (chat: number, html: string, botones?: Boton[][] | typeof TECLADO_MENU) =>
  api("sendMessage", {
    chat_id: chat,
    text: html.slice(0, 4000),
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(botones ? { reply_markup: Array.isArray(botones) ? { inline_keyboard: botones } : botones } : {}),
  })

// ------------------------------------------------------------------ Formato
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/** Convierte el Markdown simple del agente al HTML que acepta Telegram. */
function aHtml(texto: string): string {
  return texto
    .split("\n")
    .filter((l) => !/^\s*-{3,}\s*$/.test(l))
    .map((l) => {
      const lista = l.match(/^(\s*)[-*•]\s+(.*)/)
      const linea = lista ? `${"   ".repeat(Math.floor((lista[1] ?? "").length / 2))}• ${lista[2]}` : l.replace(/^#+\s*/, "")
      return esc(linea)
        .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
        .replace(/`([^`]+)`/g, "<code>$1</code>")
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

const CORTO: Record<string, string> = {
  brio_consultar_ventas: "Ventas",
  brio_definicion: "Definición",
  brio_buscar_estudios: "Estudios",
  brio_dimensiones: "Alcance",
}
const lineaPasos = (llamadas: { nombre: string; ok: boolean }[]) =>
  llamadas.length ? `<i>${llamadas.map((t) => `${t.ok ? "✓" : "✗"} ${CORTO[t.nombre] ?? t.nombre}`).join(" · ")}</i>\n\n` : ""

function lineaVerificacion(v: { cifras: number; verificadas: number; no_verificadas: string[] }) {
  if (!v.cifras) return ""
  if (!v.no_verificadas.length) return `\n\n🟢 <i>${v.verificadas} de ${v.cifras} cifras verificadas contra la tabla validada</i>`
  return `\n\n🔴 <b>Atención:</b> <i>cifras sin respaldo en los datos: ${esc(v.no_verificadas.join(", "))}. No las uses sin revisarlas.</i>`
}

// ------------------------------------------------------------------ Conversación
const generacion = new Map<number, number>() // /nuevo inicia otra sesión para el mismo chat
const turnos = new Map<number, number>()
const sesionDe = (chat: number) => `tg-${Math.abs(chat)}-${generacion.get(chat) ?? 0}`
const permitido = (u?: Usuario) => USUARIOS.length === 0 || (u ? USUARIOS.includes(String(u.id)) : false)

async function atender(chat: number, texto: string) {
  const escribiendo = setInterval(() => void api("sendChatAction", { chat_id: chat, action: "typing" }), 4500)
  void api("sendChatAction", { chat_id: chat, action: "typing" })
  try {
    const r = await procesarMensaje(sesionDe(chat), texto)
    if ("rechazo" in r) return void (await enviarTexto(chat, esc(r.rechazo)))
    const n = (turnos.get(chat) ?? 0) + 1
    turnos.set(chat, n)
    const botones: Boton[][] = r.error ? [] : [[{ text: "👍 Útil", callback_data: `fb:1:${n}` }, { text: "👎 Tiene un error", callback_data: `fb:0:${n}` }]]
    await enviarTexto(chat, lineaPasos(r.toolCalls) + aHtml(r.reply) + lineaVerificacion(r.verificacion), botones.length ? botones : undefined)
  } finally {
    clearInterval(escribiendo)
  }
}

const AYUDA = [
  "<b>Qué hago</b>",
  "Respondo preguntas sobre las ventas de Brío (por periodo, canal y región) y busco evidencia en los estudios internos de consumidor.",
  "",
  "<b>Cómo trabajo</b>",
  "• Las cifras salen de la tabla validada, no las calcula la IA. Cada respuesta indica fuente, corte y definición.",
  "• Verifico que cada cifra del texto tenga respaldo; si no, te aviso.",
  "• Si no tengo el dato, te lo digo.",
  "",
  "<b>Lo que no hago</b>",
  "No recomiendo decisiones ni respondo sobre otras marcas, margen o pronósticos. Datos sintéticos de demostración.",
].join("\n")

async function bienvenida(chat: number, nombre?: string) {
  if (nombre !== undefined) await enviarTexto(chat, `Hola ${esc(nombre)}. Soy el copiloto de análisis de Brío. <i>Cada cifra viene de la tabla validada, con su fuente.</i>`, TECLADO_MENU)
  const botones = EJEMPLOS.map((e, i) => [{ text: e.length > 60 ? e.slice(0, 57) + "…" : e, callback_data: `ej:${i}` }])
  await enviarTexto(chat, "Pregúntame lo que necesites o elige un ejemplo:", botones)
}

const vistos = new Set<number>()

async function manejarUpdate(u: Update) {
  if (vistos.has(u.update_id)) return // Telegram puede reenviar el mismo update
  vistos.add(u.update_id)
  if (vistos.size > 500) vistos.delete(vistos.values().next().value as number)

  const cb = u.callback_query
  if (cb?.message) {
    const chat = cb.message.chat.id
    await api("answerCallbackQuery", { callback_query_id: cb.id })
    await api("editMessageReplyMarkup", { chat_id: chat, message_id: cb.message.message_id, reply_markup: { inline_keyboard: [] } })
    if (!permitido(cb.from)) return void enviarTexto(chat, `No tienes acceso a este copiloto. Tu ID de Telegram es <code>${cb.from.id}</code>.`)
    const data = cb.data ?? ""
    const ej = data.match(/^ej:(\d+)$/)
    if (ej) {
      const pregunta = EJEMPLOS[Number(ej[1])]
      if (pregunta) {
        await enviarTexto(chat, `<i>${esc(pregunta)}</i>`)
        return atender(chat, pregunta)
      }
      return
    }
    const fb = data.match(/^fb:([01]):(\d+)$/)
    if (fb) {
      await registrarFeedback(sesionDe(chat), Number(fb[2]), fb[1] === "1", "telegram")
      return void enviarTexto(chat, fb[1] === "1" ? "Gracias, quedó registrado." : "Gracias. Quedó registrado para revisión; si puedes, escríbeme qué estaba mal.")
    }
    return
  }

  const m = u.message
  if (!m?.text) return
  const chat = m.chat.id
  if (!permitido(m.from)) return void enviarTexto(chat, `No tienes acceso a este copiloto. Tu ID de Telegram es <code>${m.from?.id ?? "?"}</code>; compártelo con el administrador.`)
  const texto = m.text.trim()
  const comando = texto.split(/\s|@/)[0]?.toLowerCase()
  if (comando === "/start") return bienvenida(chat, m.from?.first_name ?? "")
  if (comando === "/ejemplos" || texto === MENU.ejemplos) return bienvenida(chat)
  if (comando === "/ayuda" || texto === MENU.ayuda) return void enviarTexto(chat, AYUDA, TECLADO_MENU)
  if (comando === "/nuevo" || texto === MENU.nueva) {
    generacion.set(chat, (generacion.get(chat) ?? 0) + 1)
    turnos.delete(chat)
    await enviarTexto(chat, "Listo, empezamos una conversación nueva.", TECLADO_MENU)
    return bienvenida(chat)
  }
  return atender(chat, m.text)
}

const procesarSeguro = (u: Update) => manejarUpdate(u).catch((e) => console.error("[telegram] error:", e instanceof Error ? e.message : e))

// ------------------------------------------------------------------ Arranque
async function sondear() {
  let offset = 0
  console.log("[telegram] modo polling (local)")
  for (;;) {
    try {
      const updates = await api<Update[]>("getUpdates", { offset, timeout: 30, allowed_updates: ["message", "callback_query"] })
      for (const u of updates ?? []) {
        offset = u.update_id + 1
        void procesarSeguro(u)
      }
      if (!updates) await Bun.sleep(5000)
    } catch {
      console.warn("[telegram] el bot tiene un webhook activo (Azure): el polling local se detiene para no interferir.")
      return
    }
  }
}

export const telegram = {
  estado: () => ({ modo: MODO, acceso_restringido: USUARIOS.length > 0 }),

  async iniciar() {
    if (MODO === "apagado") return
    await api("setMyCommands", {
      commands: [
        { command: "ejemplos", description: "Preguntas de ejemplo" },
        { command: "nuevo", description: "Empezar otra conversación" },
        { command: "ayuda", description: "Qué puede hacer el copiloto" },
      ],
    }).catch(() => null)
    if (!USUARIOS.length) console.warn("[telegram] TELEGRAM_USUARIOS vacío: cualquiera puede usar el bot (con los topes diarios del agente).")
    if (MODO === "webhook") {
      const ok = await api("setWebhook", { url: `${URL_PUBLICA}/api/telegram/webhook`, secret_token: SECRETO, allowed_updates: ["message", "callback_query"], drop_pending_updates: true }).catch(() => null)
      console.log(`[telegram] modo webhook ${ok ? "registrado" : "NO registrado"}`)
      return
    }
    void sondear()
  },

  async webhook(req: Request): Promise<Response> {
    if (MODO !== "webhook") return new Response("Telegram no está configurado en modo webhook", { status: 404 })
    if (req.headers.get("x-telegram-bot-api-secret-token") !== SECRETO) return new Response("No autorizado", { status: 401 })
    let u: Update
    try {
      u = (await req.json()) as Update
    } catch {
      return new Response("JSON inválido", { status: 400 })
    }
    void procesarSeguro(u) // se responde de inmediato; el turno del agente puede tardar
    return new Response("ok")
  },
}

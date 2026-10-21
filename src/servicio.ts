// Servicio del agente, independiente del canal: lo usan el chat web (src/server.ts) y Telegram
// (src/canales/telegram.ts). Un canal nuevo solo traduce mensajes; no duplica lógica del agente.
import { readFile, mkdir, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import { crearAdaptador } from "./llm/index.ts"
import type { LLMAdapter } from "./llm/adapter.ts"
import { type Sesion, type ResultadoTurno, ejecutarTurno, nuevaSesion } from "./agent.ts"

export const ROOT = resolve(import.meta.dir, "..")
export const OUT = join(ROOT, "out")
const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d)

export const LIMITES = {
  maxIteraciones: num(process.env.MAX_ITERACIONES, 25),
  maxTokensSesion: num(process.env.MAX_TOKENS_SESION, 300_000),
  timeoutMs: num(process.env.LLM_TIMEOUT_MS, 60_000),
  maxTurnosDia: num(process.env.MAX_TURNOS_DIA, 300),
  maxLargoMensaje: 4000,
}

export let llm: LLMAdapter | null = null
export let errorLlm = ""
try {
  llm = crearAdaptador()
} catch (e) {
  errorLlm = e instanceof Error ? e.message : String(e)
  console.warn(`[agente] Modelo no configurado: ${errorLlm}`)
}

// Comportamiento (prompt) + conocimiento: se leen en cada turno para que un cambio no requiera reiniciar.
async function sistema(): Promise<string> {
  const [prompt, conocimiento] = await Promise.all([
    readFile(join(ROOT, "agent", "prompt.md"), "utf8"),
    readFile(join(ROOT, "src", "knowledge", "copiloto-brio.md"), "utf8"),
  ])
  const fecha = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date())
  return `${prompt}\n\n---\n\n${conocimiento}\n\n---\nFecha de hoy: ${fecha}.`
}

// --- Sesiones: memoria + respaldo en out/sesiones/ -------------------------------------------
const sesiones = new Map<string, Sesion>()
const ocupadas = new Set<string>()
export const ID_VALIDO = /^[A-Za-z0-9-]{8,64}$/

export async function obtenerSesion(id: string): Promise<Sesion> {
  const enMemoria = sesiones.get(id)
  if (enMemoria) return enMemoria
  const ruta = join(OUT, "sesiones", `${id}.json`)
  const s = existsSync(ruta) ? (JSON.parse(await readFile(ruta, "utf8")) as Sesion) : nuevaSesion(id)
  sesiones.set(id, s)
  return s
}
async function guardarSesion(s: Sesion) {
  await mkdir(join(OUT, "sesiones"), { recursive: true })
  await writeFile(join(OUT, "sesiones", `${s.id}.json`), JSON.stringify(s))
}

// --- Tope global diario para que nadie gaste la clave sin límite -----------------------------
let turnosHoy = { dia: "", n: 0 }
function consumirTurno(): boolean {
  const hoy = new Date().toISOString().slice(0, 10)
  if (turnosHoy.dia !== hoy) turnosHoy = { dia: hoy, n: 0 }
  if (turnosHoy.n >= LIMITES.maxTurnosDia) return false
  turnosHoy.n++
  return true
}

export type Respuesta = (ResultadoTurno & { tokensSesion?: number }) | { rechazo: string; estado: number }

const aviso = (reply: string): ResultadoTurno => ({ reply, toolCalls: [], verificacion: { cifras: 0, verificadas: 0, no_verificadas: [] }, error: true })

/** Procesa un mensaje de cualquier canal. Aplica validación, topes y bloqueo por sesión. */
export async function procesarMensaje(sessionId: string, mensaje: string): Promise<Respuesta> {
  const texto = mensaje.trim()
  if (!ID_VALIDO.test(sessionId)) return { rechazo: "sessionId inválido", estado: 400 }
  if (!texto || texto.length > LIMITES.maxLargoMensaje) return { rechazo: `El mensaje debe tener entre 1 y ${LIMITES.maxLargoMensaje} caracteres`, estado: 400 }
  if (!llm) return aviso(`⚠️ El modelo no está configurado en el servidor: ${errorLlm}`)
  if (ocupadas.has(sessionId)) return { rechazo: "Esta sesión todavía está procesando el mensaje anterior", estado: 409 }
  if (!consumirTurno()) return aviso("⚠️ Se alcanzó el tope diario de uso del agente. Intenta mañana.")

  ocupadas.add(sessionId)
  try {
    const sesion = await obtenerSesion(sessionId)
    const r = await ejecutarTurno(sesion, texto, { llm, sistema: await sistema(), directory: ROOT, limites: LIMITES })
    await guardarSesion(sesion)
    return { ...r, tokensSesion: sesion.tokens }
  } finally {
    ocupadas.delete(sessionId)
  }
}

/** Preguntas de ejemplo para la pantalla de inicio (web) y el menú de Telegram. */
export const EJEMPLOS = [
  "¿Cuánto vendió Brío en ventas netas en el tercer trimestre de 2026 frente al mismo trimestre de 2025?",
  "¿Qué canal explica más la caída de 2026 frente a 2025 (enero a septiembre)?",
  "¿Qué región cayó más en el tercer trimestre de 2026?",
  "¿Por qué el reporte de Comercial y el de Finanzas dan cifras distintas de ventas netas en 2025?",
  "¿Qué dicen los estudios internos sobre el precio en el canal tradicional?",
  "¿Cuánto vendió Brío en octubre de 2026?",
]

/** Retroalimentación del analista sobre una respuesta (mide utilidad y errores en el piloto). */
export async function registrarFeedback(sessionId: string, indice: number, util: boolean, comentario: string) {
  if (!ID_VALIDO.test(sessionId)) return false
  await mkdir(OUT, { recursive: true })
  const linea = { ts: new Date().toISOString(), sesion: sessionId, indice, util, comentario: comentario.slice(0, 500) }
  await writeFile(join(OUT, "feedback.jsonl"), JSON.stringify(linea) + "\n", { flag: "a" })
  return true
}

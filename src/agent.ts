// Ciclo del agente: prompt → modelo → herramientas → modelo … → respuesta.
// Independiente del HTTP y del proveedor: recibe un LLMAdapter y una sesión.
// Al final de cada turno, el servidor verifica las cifras del texto contra los resultados de las herramientas.
import { type LLMAdapter, type Mensaje, ErrorLLM } from "./llm/adapter.ts"
import { ejecutarHerramienta, especificaciones } from "./tools/registro.ts"
import { type Verificacion, verificarCifras } from "./verificador.ts"

export type LlamadaVisible = { nombre: string; args: Record<string, unknown>; ok: boolean; resumen: string; resultado: unknown }

export type EventoVisible = {
  rol: "usuario" | "asistente"
  texto: string
  ts: string
  toolCalls?: LlamadaVisible[]
  verificacion?: Verificacion
  error?: boolean
}

export type Sesion = {
  id: string
  creada: string
  mensajes: Mensaje[] // historial que ve el modelo
  historial: EventoVisible[] // historial que ve la persona
  tokens: number
}

export type Limites = { maxIteraciones: number; maxTokensSesion: number; timeoutMs: number }

export type ResultadoTurno = { reply: string; toolCalls: LlamadaVisible[]; verificacion: Verificacion; error?: boolean }

export const nuevaSesion = (id: string): Sesion => ({ id, creada: new Date().toISOString(), mensajes: [], historial: [], tokens: 0 })

/** Resumen de una respuesta de herramienta para mostrar en el chat (sin volcar todo el JSON). */
function paraMostrar(contenido: string): { ok: boolean; resumen: string; resultado: unknown } {
  try {
    const r = JSON.parse(contenido) as { ok: boolean; data?: Record<string, unknown>; error?: string }
    if (!r.ok) return { ok: false, resumen: r.error ?? "error", resultado: r }
    const d = r.data ?? {}
    const total = (d.total as { valor_fmt?: string } | undefined)?.valor_fmt
    const partes = [
      total ? `total: ${total}` : "",
      ...Object.entries(d).flatMap(([k, v]) => (Array.isArray(v) ? [`${k}: ${v.length}`] : [])),
    ].filter(Boolean)
    return { ok: true, resumen: partes.slice(0, 4).join(" · "), resultado: r }
  } catch {
    return { ok: false, resumen: "respuesta no válida", resultado: contenido }
  }
}

export async function ejecutarTurno(
  sesion: Sesion,
  mensajeUsuario: string,
  deps: { llm: LLMAdapter; sistema: string; directory: string; limites: Limites },
): Promise<ResultadoTurno> {
  sesion.mensajes.push({ rol: "usuario", texto: mensajeUsuario })
  sesion.historial.push({ rol: "usuario", texto: mensajeUsuario, ts: new Date().toISOString() })

  const herramientas = especificaciones()
  const ctx = { directory: deps.directory, sessionId: sesion.id }
  const llamadasTurno: LlamadaVisible[] = []
  const contenidosTurno: string[] = []
  let reply = ""
  let error = false

  for (let i = 0; ; i++) {
    if (i >= deps.limites.maxIteraciones) {
      const hechas = llamadasTurno.map((l) => `- ${l.nombre}: ${l.ok ? "ok" : "error"}`).join("\n")
      reply = `Alcancé el tope de ${deps.limites.maxIteraciones} pasos en este turno.\n\nLo que hice:\n${hechas || "- nada"}\n\nReformula la pregunta de forma más concreta.`
      sesion.mensajes.push({ rol: "asistente", texto: reply, llamadas: [] })
      break
    }
    if (sesion.tokens >= deps.limites.maxTokensSesion) {
      reply = "Esta sesión alcanzó su tope de consumo. Abre una conversación nueva para continuar."
      sesion.mensajes.push({ rol: "asistente", texto: reply, llamadas: [] })
      error = true
      break
    }

    let r
    try {
      r = await deps.llm.enviar(deps.sistema, sesion.mensajes, herramientas, AbortSignal.timeout(deps.limites.timeoutMs))
    } catch (e) {
      reply = e instanceof ErrorLLM ? `⚠️ ${e.message}` : "⚠️ Ocurrió un error inesperado al consultar el modelo."
      if (!(e instanceof ErrorLLM)) console.error("[agente] error no tipado:", e instanceof Error ? e.message : e)
      sesion.mensajes.push({ rol: "asistente", texto: reply, llamadas: [] })
      error = true
      break
    }

    sesion.tokens += r.tokens
    sesion.mensajes.push({ rol: "asistente", texto: r.texto, llamadas: r.llamadas, crudo: r.crudo })

    if (r.llamadas.length === 0) {
      reply = r.texto || "No obtuve respuesta del modelo. Intenta reformular la pregunta."
      break
    }

    const resultados = []
    for (const l of r.llamadas) {
      const contenido = await ejecutarHerramienta(l.nombre, l.args, ctx)
      resultados.push({ id: l.id, nombre: l.nombre, contenido })
      contenidosTurno.push(contenido)
      llamadasTurno.push({ nombre: l.nombre, args: l.args, ...paraMostrar(contenido) })
    }
    sesion.mensajes.push({ rol: "herramienta", resultados })
  }

  // Control del servidor: toda cifra del texto debe estar respaldada por una herramienta de este turno
  // o de turnos anteriores de la misma sesión (respuestas de seguimiento).
  const previos = sesion.mensajes.flatMap((m) => (m.rol === "herramienta" ? m.resultados.map((x) => x.contenido) : []))
  const verificacion = error ? { cifras: 0, verificadas: 0, no_verificadas: [] } : verificarCifras(reply, [...contenidosTurno, ...previos], mensajeUsuario)

  sesion.historial.push({ rol: "asistente", texto: reply, ts: new Date().toISOString(), toolCalls: llamadasTurno, verificacion, error })
  return { reply, toolCalls: llamadasTurno, verificacion, error }
}

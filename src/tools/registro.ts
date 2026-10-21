// Registro de herramientas: descubre los exports de cada módulo, valida argumentos con zod,
// ejecuta y deja traza auditable (out/log.jsonl). Lo usan el servidor, demo.ts y la evaluación.
import { z } from "zod"
import { join } from "node:path"
import * as brio from "./brio.ts"
import { type ToolCtx, anexarLinea, fail } from "./lib/base.ts"

type HerramientaGenerica = {
  description: string
  args: z.ZodRawShape
  execute: (args: never, ctx: ToolCtx) => Promise<string>
}

const MODULOS: Record<string, Record<string, unknown>> = { brio }

const esHerramienta = (x: unknown): x is HerramientaGenerica =>
  typeof x === "object" && x !== null && "execute" in x && "args" in x && "description" in x

/** Nombre visible para el modelo: <archivo>_<export>. */
export const HERRAMIENTAS: Record<string, HerramientaGenerica> = Object.fromEntries(
  Object.entries(MODULOS).flatMap(([archivo, mod]) =>
    Object.entries(mod)
      .filter(([, v]) => esHerramienta(v))
      .map(([nombre, v]) => [`${archivo}_${nombre}`, v as HerramientaGenerica]),
  ),
)

export type EspecHerramienta = { name: string; description: string; parameters: Record<string, unknown> }

/** Convierte los esquemas zod a JSON Schema simple, aceptado por los proveedores de LLM. */
export function especificaciones(): EspecHerramienta[] {
  return Object.entries(HERRAMIENTAS).map(([name, h]) => {
    const schema = z.toJSONSchema(z.object(h.args)) as Record<string, unknown>
    delete schema.$schema
    delete schema.additionalProperties
    return { name, description: h.description, parameters: schema }
  })
}

/** Resumen corto y sin datos sensibles para los logs: solo conteos, rutas, formatos y banderas. */
function resumir(resultado: string): { ok: boolean; resumen: string } {
  try {
    const r = JSON.parse(resultado) as { ok: boolean; data?: Record<string, unknown>; error?: string }
    if (!r.ok) return { ok: false, resumen: r.error ?? "error" }
    const partes = Object.entries(r.data ?? {}).flatMap(([k, v]) => {
      if (Array.isArray(v)) return [`${k}=${v.length}`]
      if (typeof v === "boolean") return [`${k}=${v}`]
      if (k === "metrica" && typeof v === "string") return [`${k}=${v}`]
      return []
    })
    return { ok: true, resumen: partes.join(" ") }
  } catch {
    return { ok: false, resumen: "respuesta no JSON" }
  }
}

/** Valida y ejecuta una herramienta. Nunca lanza: los errores vuelven al modelo como { ok:false }. */
export async function ejecutarHerramienta(nombre: string, argsCrudos: unknown, ctx: ToolCtx): Promise<string> {
  const h = HERRAMIENTAS[nombre]
  let resultado: string
  if (!h) {
    resultado = fail(`Herramienta desconocida: ${nombre}`)
  } else {
    const parsed = z.object(h.args).safeParse(argsCrudos ?? {})
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      resultado = fail(`Argumentos inválidos: ${issue?.path.join(".") || "args"} — ${issue?.message ?? "no cumple el esquema"}`)
    } else {
      try {
        resultado = await h.execute(parsed.data as never, ctx)
      } catch (e) {
        resultado = fail(`Error inesperado: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  const { ok, resumen } = resumir(resultado)
  // Traza auditable: quién preguntó (sesión), qué herramienta, con qué argumentos y si respondió.
  const linea = { ts: new Date().toISOString(), sesion: ctx.sessionId, herramienta: nombre, args: argsCrudos, ok, resumen }
  try {
    await anexarLinea(join(ctx.directory, "out", "log.jsonl"), linea)
  } catch {
    /* el log nunca debe tumbar la herramienta */
  }
  return resultado
}

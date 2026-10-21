// Tipos y utilidades compartidas por las herramientas.
// Regla de oro: ninguna herramienta lanza excepciones; siempre devuelve { ok, data } u { ok: false, error }.
import { z } from "zod"
import { mkdir, appendFile } from "node:fs/promises"
import { join } from "node:path"

export type ToolCtx = {
  directory: string // raíz del proyecto
  sessionId: string
}

export type Herramienta<S extends z.ZodRawShape> = {
  description: string
  args: S
  execute: (args: z.infer<z.ZodObject<S>>, ctx: ToolCtx) => Promise<string>
}

export const ok = <T>(data: T): string => JSON.stringify({ ok: true, data })
export const fail = (error: string): string => JSON.stringify({ ok: false, error })

/** Envuelve la lógica para garantizar que nunca se propague una excepción hacia el agente. */
export function seguro<A>(fn: (args: A, ctx: ToolCtx) => Promise<string>) {
  return async (args: A, ctx: ToolCtx): Promise<string> => {
    try {
      return await fn(args, ctx)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return fail(`Error interno de la herramienta: ${msg}`)
    }
  }
}

export const rutas = (directory: string) => ({
  ventas: join(directory, "datos", "ventas_brio_validada.csv"),
  definiciones: join(directory, "src", "knowledge", "definiciones.json"),
  estudios: join(directory, "datos", "estudios"),
  out: join(directory, "out"),
})

export async function anexarLinea(ruta: string, obj: unknown): Promise<void> {
  await mkdir(join(ruta, ".."), { recursive: true })
  await appendFile(ruta, JSON.stringify(obj) + "\n")
}

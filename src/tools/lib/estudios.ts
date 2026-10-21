// Búsqueda en estudios internos: devuelve fragmentos TEXTUALES con estudio, sección y fecha.
// No resume ni reescribe: el copiloto solo puede citar lo que esta función devuelve.
import { readdirSync, readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { normalizar } from "./ventas.ts"

export type Fragmento = { id: string; estudio: string; archivo: string; fecha: string; seccion: string; texto: string; puntaje: number }

const VACIAS = new Set("de la el los las del en y o a un una por para con que se su sus es al lo como mas menos sobre entre brio estudio estudios".split(" "))
const tokens = (s: string) => normalizar(s).replace(/[^a-z0-9 ]/g, " ").split(" ").filter((t) => t.length > 2 && !VACIAS.has(t))
const raiz = (t: string) => t.replace(/(es|s)$/, "").slice(0, 7)

type Estudio = { archivo: string; titulo: string; fecha: string; secciones: { titulo: string; parrafos: string[] }[] }

function leer(dir: string): Estudio[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((f) => f.endsWith(".md")).sort().map((archivo) => {
    const lineas = readFileSync(join(dir, archivo), "utf8").split(/\r?\n/)
    const titulo = (lineas.find((l) => l.startsWith("# ")) ?? archivo).replace(/^#\s*/, "")
    const fecha = (lineas.find((l) => l.startsWith("Fecha:")) ?? "").replace("Fecha:", "").trim()
    const secciones: Estudio["secciones"] = []
    for (const l of lineas) {
      if (l.startsWith("## ")) secciones.push({ titulo: l.slice(3).trim(), parrafos: [] })
      else if (l.trim() && secciones.length) secciones[secciones.length - 1]!.parrafos.push(l.trim())
    }
    return { archivo, titulo, fecha, secciones }
  })
}

export const listarEstudios = (dir: string) => leer(dir).map((e) => ({ estudio: e.titulo, fecha: e.fecha, archivo: e.archivo }))

export function buscarFragmentos(dir: string, consulta: string, max = 3): Fragmento[] {
  const q = [...new Set(tokens(consulta).map(raiz))]
  if (!q.length) return []
  const out: Fragmento[] = []
  for (const e of leer(dir)) {
    const enTitulo = new Set(tokens(e.titulo).map(raiz))
    e.secciones.forEach((s, i) => {
      s.parrafos.forEach((p, j) => {
        const enTexto = new Set(tokens(`${s.titulo} ${p}`).map(raiz))
        const coincidencias = q.filter((t) => enTexto.has(t)).length
        if (!coincidencias) return
        const puntaje = coincidencias + 0.5 * q.filter((t) => enTitulo.has(t)).length
        out.push({ id: `${e.archivo.replace(/\.md$/, "")}#${i + 1}.${j + 1}`, estudio: e.titulo, archivo: `datos/estudios/${e.archivo}`, fecha: e.fecha, seccion: s.titulo, texto: p, puntaje })
      })
    })
  }
  return out.sort((a, b) => b.puntaje - a.puntaje).slice(0, max)
}

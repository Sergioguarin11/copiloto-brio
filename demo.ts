// Verificación SIN modelo: corre la batería de preguntas de referencia directamente contra las herramientas
// y compara con los valores calculados a mano en Python (scripts/esperados.py → datos/bateria.json).
// Criterio de aceptación: 0 diferencias. También prueba el verificador de cifras.
//   bun run demo.ts
import { readFile, mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { ejecutarHerramienta } from "./src/tools/registro.ts"
import { verificarCifras } from "./src/verificador.ts"

const ROOT = import.meta.dir
type Pregunta = { id: string; pregunta: string; tipo: string; consulta: { herramienta: string; args: Record<string, unknown> } | null; esperado: Record<string, any> | null; nota: string }
const { preguntas } = JSON.parse(await readFile(join(ROOT, "datos", "bateria.json"), "utf8")) as { preguntas: Pregunta[] }
const ctx = { directory: ROOT, sessionId: "demo-sin-modelo" }

type Resultado = { id: string; ok: boolean; detalle: string }
const resultados: Resultado[] = []
const difs: string[] = []
const comparar = (id: string, campo: string, obtenido: unknown, esperado: unknown) => {
  if (obtenido !== esperado) difs.push(`${id} · ${campo}: obtenido "${obtenido}" ≠ esperado "${esperado}"`)
}

for (const p of preguntas) {
  if (!p.consulta) {
    resultados.push({ id: p.id, ok: true, detalle: `solo con modelo: ${p.nota}` })
    continue
  }
  const r = JSON.parse(await ejecutarHerramienta(p.consulta.herramienta, p.consulta.args, ctx)) as { ok: boolean; data?: any; error?: string }
  const antes = difs.length
  const e = p.esperado ?? {}
  if (e.error_contiene) {
    if (r.ok) difs.push(`${p.id}: debía responder "no tengo el dato" y respondió datos`)
    else comparar(p.id, "error", r.error?.includes(e.error_contiene), true)
  } else if (!r.ok) {
    difs.push(`${p.id}: error inesperado: ${r.error}`)
  } else if (p.tipo === "cifra") {
    for (const [k, v] of Object.entries(e.total ?? {})) comparar(p.id, `total.${k}`, r.data.total[k], v)
    for (const [grupo, campos] of Object.entries(e.filas ?? {})) {
      const fila = r.data.filas.find((f: any) => f.grupo === grupo)
      if (!fila) difs.push(`${p.id}: falta el grupo ${grupo}`)
      else for (const [k, v] of Object.entries(campos as object)) comparar(p.id, `${grupo}.${k}`, fila[k], v)
    }
    if (e.mayor_caida) {
      const peor = [...r.data.filas].sort((a: any, b: any) => a.variacion - b.variacion)[0]
      comparar(p.id, "mayor_caida", peor.grupo, e.mayor_caida)
    }
    if (!r.data.ficha?.fuente || !r.data.ficha?.corte || !r.data.ficha?.definicion) difs.push(`${p.id}: ficha incompleta`)
  } else if (p.tipo === "definicion") {
    const c = Object.fromEntries(r.data.comparacion.map((x: any) => [x.id, x]))
    comparar(p.id, "finanzas", c.finanzas.valor_fmt, e.comparacion.finanzas)
    comparar(p.id, "comercial", c.comercial.valor_fmt, e.comparacion.comercial)
    comparar(p.id, "mercadeo", c.mercadeo.valor_fmt, e.comparacion.mercadeo)
    comparar(p.id, "diferencia_comercial", c.comercial.diferencia_fmt, e.comparacion.diferencia_comercial)
    comparar(p.id, "diferencia_mercadeo", c.mercadeo.diferencia_fmt, e.comparacion.diferencia_mercadeo)
  } else if (p.tipo === "estudio") {
    comparar(p.id, "estudio", r.data.fragmentos[0]?.estudio?.includes(e.estudio_contiene), true)
  }
  resultados.push({ id: p.id, ok: difs.length === antes, detalle: r.ok ? (r.data.total?.valor_fmt ?? r.data.fragmentos?.[0]?.estudio ?? "ok") : `no tengo el dato → ${r.error}` })
}

// --- Verificador de cifras: una respuesta fiel pasa; una cifra inventada se detecta ----------------------
const c02 = await ejecutarHerramienta("brio_consultar_ventas", preguntas.find((p) => p.id === "C02")!.consulta!.args, ctx)
const d = JSON.parse(c02).data
const fiel = `Las ventas netas del T3 2026 fueron ${d.total.valor_fmt}, ${d.total.variacion_fmt} frente a ${d.total.comparado_fmt} en el T3 2025.`
const inventada = `Las ventas netas del T3 2026 fueron COP 8.123,4 M, una caída de 3,7 % frente a 2025.`
const vFiel = verificarCifras(fiel, [c02])
const vInv = verificarCifras(inventada, [c02])
if (vFiel.no_verificadas.length) difs.push(`verificador: marcó cifras fieles como no verificadas: ${vFiel.no_verificadas.join(", ")}`)
if (vInv.no_verificadas.length < 2) difs.push(`verificador: no detectó las cifras inventadas (${vInv.no_verificadas.join(", ")})`)
resultados.push({ id: "V01", ok: !vFiel.no_verificadas.length, detalle: `respuesta fiel: ${vFiel.verificadas}/${vFiel.cifras} cifras verificadas` })
resultados.push({ id: "V02", ok: vInv.no_verificadas.length >= 2, detalle: `respuesta con cifras inventadas: detectadas ${vInv.no_verificadas.join(", ")}` })

// --- Reporte -----------------------------------------------------------------------------------------
console.log("\nBatería de referencia contra herramientas (sin modelo)\n")
for (const r of resultados) console.log(`${r.ok ? "✓" : "✗"} ${r.id.padEnd(4)} ${r.detalle}`)
console.log(`\n${difs.length === 0 ? "✅ 0 diferencias contra el cálculo manual" : `❌ ${difs.length} diferencias:\n- ${difs.join("\n- ")}`}`)
await mkdir(join(ROOT, "out"), { recursive: true })
await writeFile(join(ROOT, "out", "demo.json"), JSON.stringify({ fecha: new Date().toISOString(), diferencias: difs, resultados }, null, 2))
if (difs.length) process.exit(1)

// Prueba REAL con IA: corre la batería de preguntas de referencia por el copiloto completo (modelo + herramientas)
// y mide lo que importa para salir al piloto:
//   - exactitud: las cifras esperadas (calculadas a mano) aparecen en la respuesta
//   - consulta correcta: el modelo llamó la herramienta correcta con la métrica y el periodo correctos
//   - honestidad: en preguntas fuera de alcance responde "no tengo el dato" en lugar de inventar
//   - verificador: ninguna cifra del texto queda sin respaldo
// Requiere GEMINI_API_KEY. Uso:
//   bun run evaluar                 → toda la batería
//   bun run evaluar C02 F03 E01     → solo esas preguntas
// Salida: out/evaluacion.json y out/evaluacion.md (evidencia para 07_Evidencia_Prueba_IA)
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { join, resolve } from "node:path"
import { crearAdaptador } from "../src/llm/index.ts"
import { ejecutarTurno, nuevaSesion } from "../src/agent.ts"
import { normalizar } from "../src/tools/lib/ventas.ts"

const ROOT = resolve(import.meta.dir, "..")
type Pregunta = { id: string; pregunta: string; tipo: string; consulta: { herramienta: string; args: Record<string, any> } | null; esperado: Record<string, any> | null; nota: string }
const { preguntas } = JSON.parse(await readFile(join(ROOT, "datos", "bateria.json"), "utf8")) as { preguntas: Pregunta[] }
const filtro = process.argv.slice(2)
const lista = filtro.length ? preguntas.filter((p) => filtro.includes(p.id)) : preguntas
const pausaMs = Number(process.env.EVAL_PAUSA_MS ?? 4000)

const llm = crearAdaptador()
const [prompt, conocimiento] = await Promise.all([readFile(join(ROOT, "agent", "prompt.md"), "utf8"), readFile(join(ROOT, "src", "knowledge", "copiloto-brio.md"), "utf8")])
const sistema = `${prompt}\n\n---\n\n${conocimiento}\n\n---\nFecha de hoy: 2026-10-21.`
const limites = { maxIteraciones: 8, maxTokensSesion: 200_000, timeoutMs: 90_000 }

const norm = (s: string) => normalizar(s).replace(/\s+/g, " ")
/** Cifras esperadas que deberían aparecer en el texto (en su forma numérica, sin "COP"/"M"). */
function cifrasEsperadas(p: Pregunta): string[] {
  const e = p.esperado ?? {}
  const vals: string[] = []
  const tomar = (o: Record<string, unknown>) => ["valor_fmt", "variacion_fmt"].forEach((k) => typeof o[k] === "string" && vals.push(o[k] as string))
  // C04 pregunta por la región que más cayó: se exigen sus cifras, no el total de la marca.
  if (e.mayor_caida) tomar(e.filas[e.mayor_caida] ?? {})
  else if (e.total) tomar(e.total)
  if (e.comparacion) vals.push(e.comparacion.finanzas, e.comparacion.comercial)
  return vals.map((v) => v.replace(/^COP\s*/, "").replace(/\s*(M|%|pp|unidades)$/, "").replace(/^\+/, "").trim())
}
const contiene = (texto: string, cifra: string) => texto.replace(/−/g, "-").includes(cifra) || texto.includes(cifra.replace(/^-/, ""))

type Fila = { id: string; tipo: string; pregunta: string; respuesta: string; herramientas: string[]; consulta_correcta: boolean | null; exactitud: boolean | null; honestidad: boolean | null; cifras_texto: number; no_verificadas: string[]; segundos: number; tokens: number; error?: string }
const filas: Fila[] = []

for (const [i, p] of lista.entries()) {
  const sesion = nuevaSesion(`eval-${p.id}-${Date.now()}`)
  const t0 = Date.now()
  let fila: Fila
  try {
    const r = await ejecutarTurno(sesion, p.pregunta, { llm, sistema, directory: ROOT, limites })
    const usadas = r.toolCalls.map((t) => t.nombre)
    let consulta: boolean | null = null
    // En preguntas fuera de alcance lo que importa es la honestidad, no qué herramienta usó.
    if (p.consulta && p.tipo !== "fuera_de_alcance") {
      const a = p.consulta.args
      consulta = r.toolCalls.some((t) => t.nombre === p.consulta!.herramienta && ["metrica", "desde", "hasta", "comparar_desde", "comparar_hasta"].every((k) => a[k] === undefined || t.args[k] === a[k]) && (a.comparar_con === undefined || a.comparar_con === "ninguna" || t.args.comparar_con === a.comparar_con))
    }
    const esperadas = cifrasEsperadas(p)
    const exactitud = esperadas.length ? esperadas.every((c) => contiene(r.reply, c)) : null
    const t = norm(r.reply)
    const honestidad = p.tipo === "fuera_de_alcance" ? /no tengo|no dispongo|no cuento|no esta disponible|no hay (datos|evidencia|fragmentos)|fuera de(l)? (alcance|corte)|no encontre/.test(t) : null
    fila = { id: p.id, tipo: p.tipo, pregunta: p.pregunta, respuesta: r.reply, herramientas: usadas, consulta_correcta: consulta, exactitud, honestidad, cifras_texto: r.verificacion.cifras, no_verificadas: r.verificacion.no_verificadas, segundos: Math.round((Date.now() - t0) / 100) / 10, tokens: sesion.tokens, error: r.error ? r.reply : undefined }
  } catch (e) {
    fila = { id: p.id, tipo: p.tipo, pregunta: p.pregunta, respuesta: "", herramientas: [], consulta_correcta: null, exactitud: null, honestidad: null, cifras_texto: 0, no_verificadas: [], segundos: 0, tokens: 0, error: e instanceof Error ? e.message : String(e) }
  }
  filas.push(fila)
  const marca = (x: boolean | null) => (x === null ? "·" : x ? "✓" : "✗")
  console.log(`${p.id} consulta ${marca(fila.consulta_correcta)} exactitud ${marca(fila.exactitud)} honestidad ${marca(fila.honestidad)} sin-respaldo ${fila.no_verificadas.length} · ${fila.segundos}s${fila.error ? ` · ERROR ${fila.error}` : ""}`)
  if (i < lista.length - 1) await Bun.sleep(pausaMs)
}

const tasa = (xs: (boolean | null)[]) => {
  const v = xs.filter((x): x is boolean => x !== null)
  return v.length ? { aciertos: v.filter(Boolean).length, total: v.length } : { aciertos: 0, total: 0 }
}
const resumen = {
  fecha: new Date().toISOString(),
  modelo: `${llm.proveedor}/${llm.modelo}`,
  preguntas: filas.length,
  consulta_correcta: tasa(filas.map((f) => f.consulta_correcta)),
  exactitud_cifras: tasa(filas.map((f) => f.exactitud)),
  honestidad_fuera_de_alcance: tasa(filas.map((f) => f.honestidad)),
  respuestas_con_cifras_sin_respaldo: filas.filter((f) => f.no_verificadas.length).length,
  errores_tecnicos: filas.filter((f) => f.error).length,
  segundos_promedio: Math.round((filas.reduce((s, f) => s + f.segundos, 0) / Math.max(1, filas.length)) * 10) / 10,
}
await mkdir(join(ROOT, "out"), { recursive: true })
await writeFile(join(ROOT, "out", "evaluacion.json"), JSON.stringify({ resumen, filas }, null, 2))
const pct = (x: { aciertos: number; total: number }) => (x.total ? `${x.aciertos}/${x.total}` : "n/a")
const md = [
  `# Evaluación con IA · ${resumen.fecha.slice(0, 16).replace("T", " ")} UTC`,
  "",
  `Modelo: ${resumen.modelo} · Preguntas: ${resumen.preguntas}`,
  "",
  "| Indicador | Resultado | Meta para salir al piloto |",
  "|---|---|---|",
  `| Consulta correcta (herramienta, métrica y periodo) | ${pct(resumen.consulta_correcta)} | ≥ 90 % |`,
  `| Exactitud de cifras vs cálculo manual | ${pct(resumen.exactitud_cifras)} | 100 % |`,
  `| Honestidad en preguntas fuera de alcance | ${pct(resumen.honestidad_fuera_de_alcance)} | 100 % |`,
  `| Respuestas con cifras sin respaldo (verificador) | ${resumen.respuestas_con_cifras_sin_respaldo} | 0 |`,
  `| Errores técnicos | ${resumen.errores_tecnicos} | 0 |`,
  `| Tiempo promedio por respuesta | ${resumen.segundos_promedio} s | — |`,
  "",
  "## Detalle",
  "",
  "| ID | Tipo | Herramientas | Consulta | Exactitud | Honestidad | Sin respaldo | s |",
  "|---|---|---|---|---|---|---|---|",
  ...filas.map((f) => `| ${f.id} | ${f.tipo} | ${f.herramientas.join(", ") || "—"} | ${f.consulta_correcta ?? "·"} | ${f.exactitud ?? "·"} | ${f.honestidad ?? "·"} | ${f.no_verificadas.join(" ") || "0"} | ${f.segundos} |`),
  "",
  "## Respuestas",
  "",
  ...filas.flatMap((f) => [`### ${f.id} · ${f.pregunta}`, "", f.error ? `**Error:** ${f.error}` : f.respuesta, ""]),
].join("\n")
await writeFile(join(ROOT, "out", "evaluacion.md"), md)
console.log(`\nResumen: consulta ${pct(resumen.consulta_correcta)} · exactitud ${pct(resumen.exactitud_cifras)} · honestidad ${pct(resumen.honestidad_fuera_de_alcance)} · sin respaldo ${resumen.respuestas_con_cifras_sin_respaldo}`)
console.log("Evidencia: out/evaluacion.md y out/evaluacion.json")

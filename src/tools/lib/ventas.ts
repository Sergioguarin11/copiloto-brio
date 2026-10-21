// Lógica de datos pura (sin modelo, sin HTTP): carga la tabla validada, filtra, agrega y da formato.
// Toda cifra que el copiloto muestra sale de aquí. Lo usan las herramientas, demo.ts y la evaluación.
import { readFileSync } from "node:fs"

export type Fila = {
  mes: string
  canal: string
  region: string
  ventas_brutas_cop: number
  descuentos_cop: number
  devoluciones_cop: number
  ventas_netas_cop: number
  unidades: number
}

export const METRICAS = ["ventas_netas", "ventas_brutas", "descuentos", "devoluciones", "unidades", "descuento_pct"] as const
export type Metrica = (typeof METRICAS)[number]
export const AGRUPACIONES = ["total", "mes", "trimestre", "anio", "canal", "region"] as const
export type Agrupacion = (typeof AGRUPACIONES)[number]
export const COMPARACIONES = ["ninguna", "periodo_anterior", "mismo_periodo_anio_anterior"] as const
export type Comparacion = (typeof COMPARACIONES)[number]

const cache = new Map<string, Fila[]>()
export function cargarVentas(ruta: string): Fila[] {
  const c = cache.get(ruta)
  if (c) return c
  const [cab, ...lineas] = readFileSync(ruta, "utf8").trim().split(/\r?\n/)
  const cols = (cab ?? "").split(",")
  const filas = lineas.map((l) => {
    const v = l.split(",")
    const o: Record<string, string | number> = {}
    cols.forEach((k, i) => (o[k] = i < 3 ? (v[i] ?? "") : Number(v[i])))
    return o as unknown as Fila
  })
  cache.set(ruta, filas)
  return filas
}

// ------------------------------------------------------------------ Formato colombiano
function miles(entero: string): string {
  return entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}
export function fmtNum(v: number, dec = 0): string {
  const s = Math.abs(v).toFixed(dec)
  const [e, d] = s.split(".")
  return `${v < 0 ? "-" : ""}${miles(e ?? "0")}${d ? "," + d : ""}`
}
/** COP en millones con un decimal: "COP 36.000,0 M". */
export const fmtCop = (v: number) => `COP ${fmtNum(v / 1e6, 1)} M`
export const fmtPct = (x: number) => `${fmtNum(x * 100, 1)} %`
export const fmtVar = (x: number) => `${x >= 0 ? "+" : ""}${fmtNum(x * 100, 1)} %`
export const fmtPp = (x: number) => `${x >= 0 ? "+" : ""}${fmtNum(x * 100, 1)} pp`
export function fmtValor(m: Metrica, v: number): string {
  if (m === "descuento_pct") return fmtPct(v)
  if (m === "unidades") return `${fmtNum(v)} unidades`
  return fmtCop(v)
}

// ------------------------------------------------------------------ Periodos
export const MES_VALIDO = /^20\d{2}-(0[1-9]|1[0-2])$/
export function sumarMeses(mes: string, n: number): string {
  const a = Number(mes.slice(0, 4)), m = Number(mes.slice(5, 7)) - 1 + n
  const aa = a + Math.floor(m / 12), mm = ((m % 12) + 12) % 12
  return `${aa}-${String(mm + 1).padStart(2, "0")}`
}
export function rangoMeses(desde: string, hasta: string): string[] {
  const out: string[] = []
  for (let m = desde; m <= hasta; m = sumarMeses(m, 1)) out.push(m)
  return out
}
export const trimestre = (mes: string) => `${mes.slice(0, 4)}-T${Math.floor((Number(mes.slice(5, 7)) - 1) / 3) + 1}`

export const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim()

// ------------------------------------------------------------------ Agregación
export function valorMetrica(m: Metrica, filas: Fila[]): number {
  const s = (k: keyof Fila) => filas.reduce((t, f) => t + (f[k] as number), 0)
  switch (m) {
    case "ventas_netas": return s("ventas_netas_cop")
    case "ventas_brutas": return s("ventas_brutas_cop")
    case "descuentos": return s("descuentos_cop")
    case "devoluciones": return s("devoluciones_cop")
    case "unidades": return s("unidades")
    case "descuento_pct": {
      const b = s("ventas_brutas_cop")
      return b ? s("descuentos_cop") / b : 0
    }
  }
}

export type Consulta = {
  metrica: Metrica
  desde: string
  hasta: string
  agrupar_por: Agrupacion
  canal?: string
  region?: string
  comparar_con: Comparacion
}

export type FilaResultado = {
  grupo: string
  valor: number
  valor_fmt: string
  comparado?: number
  comparado_fmt?: string
  variacion?: number
  variacion_fmt?: string
}

export type ResultadoConsulta = {
  metrica: Metrica
  periodo: { desde: string; hasta: string; meses: number }
  periodo_comparado: { desde: string; hasta: string } | null
  filtros: { canal: string | null; region: string | null }
  agrupar_por: Agrupacion
  filas: FilaResultado[]
  total: FilaResultado
  advertencias: string[]
}

type Rango = { primer: string; ultimo: string; canales: string[]; regiones: string[] }

/** Busca un valor válido sin importar tildes ni mayúsculas. */
export function resolverValor(v: string | undefined, validos: string[]): string | null | undefined {
  if (!v) return undefined
  const n = normalizar(v)
  return validos.find((x) => normalizar(x) === n) ?? null
}

/** Ejecuta una consulta. Devuelve error de negocio (string) si no se puede responder con la tabla. */
export function consultar(filasTabla: Fila[], q: Consulta, rango: Rango): ResultadoConsulta | string {
  if (!MES_VALIDO.test(q.desde) || !MES_VALIDO.test(q.hasta)) return "Los meses deben tener el formato AAAA-MM."
  if (q.desde > q.hasta) return "El mes inicial es posterior al mes final."
  if (q.desde < rango.primer || q.hasta > rango.ultimo)
    return `No tengo ese dato: la tabla validada cubre de ${rango.primer} a ${rango.ultimo} (corte de datos). No hay cifras fuera de ese rango.`
  const canal = resolverValor(q.canal, rango.canales)
  if (canal === null) return `No tengo el canal "${q.canal}". Canales disponibles: ${rango.canales.join(", ")}.`
  const region = resolverValor(q.region, rango.regiones)
  if (region === null) return `No tengo la región "${q.region}". Regiones disponibles: ${rango.regiones.join(", ")}.`

  const meses = rangoMeses(q.desde, q.hasta)
  const advertencias: string[] = []
  let desplazamiento = 0
  if (q.comparar_con === "periodo_anterior") desplazamiento = -meses.length
  if (q.comparar_con === "mismo_periodo_anio_anterior") desplazamiento = -12
  let periodoComparado: ResultadoConsulta["periodo_comparado"] = null
  if (desplazamiento) {
    const d = sumarMeses(q.desde, desplazamiento), h = sumarMeses(q.hasta, desplazamiento)
    if (d < rango.primer) {
      advertencias.push(`No hay datos para comparar: el periodo ${d} a ${h} es anterior al inicio de la tabla (${rango.primer}).`)
      desplazamiento = 0
    } else periodoComparado = { desde: d, hasta: h }
  }

  const pasaFiltro = (f: Fila) => (!canal || f.canal === canal) && (!region || f.region === region)
  const base = filasTabla.filter(pasaFiltro)
  const clave = (f: Fila): string => {
    switch (q.agrupar_por) {
      case "total": return "Total"
      case "mes": return f.mes
      case "trimestre": return trimestre(f.mes)
      case "anio": return f.mes.slice(0, 4)
      case "canal": return f.canal
      case "region": return f.region
    }
  }
  const enPeriodo = new Set(meses)
  const grupos = new Map<string, Set<string>>() // grupo -> meses del grupo
  for (const f of base) if (enPeriodo.has(f.mes)) (grupos.get(clave(f)) ?? grupos.set(clave(f), new Set()).get(clave(f))!).add(f.mes)

  const temporal = ["mes", "trimestre", "anio"].includes(q.agrupar_por)
  const filaDe = (grupo: string, mesesGrupo: Set<string>, esTotal = false): FilaResultado => {
    const delGrupo = (f: Fila, ms: Set<string>) => ms.has(f.mes) && (esTotal || temporal || q.agrupar_por === "total" || clave(f) === grupo)
    const valor = valorMetrica(q.metrica, base.filter((f) => delGrupo(f, mesesGrupo)))
    const r: FilaResultado = { grupo, valor, valor_fmt: fmtValor(q.metrica, valor) }
    if (desplazamiento) {
      const msComp = new Set([...mesesGrupo].map((m) => sumarMeses(m, desplazamiento)))
      const comparado = valorMetrica(q.metrica, base.filter((f) => delGrupo(f, msComp)))
      r.comparado = comparado
      r.comparado_fmt = fmtValor(q.metrica, comparado)
      if (q.metrica === "descuento_pct") {
        r.variacion = valor - comparado
        r.variacion_fmt = fmtPp(r.variacion)
      } else if (comparado) {
        r.variacion = valor / comparado - 1
        r.variacion_fmt = fmtVar(r.variacion)
      }
    }
    return r
  }

  let filas = [...grupos.entries()].map(([g, ms]) => filaDe(g, ms))
  filas = temporal ? filas.sort((a, b) => a.grupo.localeCompare(b.grupo)) : filas.sort((a, b) => b.valor - a.valor)
  const total = filaDe("Total", enPeriodo, true)
  if (!filas.length) advertencias.push("No hay registros con esos filtros en el periodo.")
  return {
    metrica: q.metrica,
    periodo: { desde: q.desde, hasta: q.hasta, meses: meses.length },
    periodo_comparado: periodoComparado,
    filtros: { canal: canal ?? null, region: region ?? null },
    agrupar_por: q.agrupar_por,
    filas: q.agrupar_por === "total" ? [] : filas,
    total,
    advertencias,
  }
}

/** Total del periodo bajo cada definición histórica de "ventas netas" (explica las "dos cifras distintas"). */
export function compararDefiniciones(filasTabla: Fila[], desde: string, hasta: string) {
  const ms = new Set(rangoMeses(desde, hasta))
  const f = filasTabla.filter((x) => ms.has(x.mes))
  const brutas = valorMetrica("ventas_brutas", f)
  const desc = valorMetrica("descuentos", f)
  const dev = valorMetrica("devoluciones", f)
  const adoptada = brutas - desc - dev
  const def = (id: string, reporte: string, v: number) => ({
    id, reporte, valor: v, valor_fmt: fmtCop(v),
    diferencia_vs_definicion_unica: v - adoptada, diferencia_fmt: fmtCop(v - adoptada),
    diferencia_pct_fmt: fmtVar(adoptada ? v / adoptada - 1 : 0),
  })
  return [def("finanzas", "Cierre de Finanzas (definición única)", adoptada), def("comercial", "Reporte de Comercial", brutas - desc), def("mercadeo", "Reporte de Mercadeo", brutas)]
}

// Herramientas del Copiloto de análisis Brío. Cada export es una herramienta; el modelo la ve como brio_<export>.
// Son la ÚNICA fuente de cifras que el copiloto puede afirmar: la IA interpreta y redacta, la tabla calcula.
import { z } from "zod"
import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { type Herramienta, type ToolCtx, ok, fail, seguro, rutas } from "./lib/base.ts"
import { METRICAS, AGRUPACIONES, COMPARACIONES, MES_VALIDO, cargarVentas, consultar, compararDefiniciones, type Metrica } from "./lib/ventas.ts"
import { buscarFragmentos, listarEstudios } from "./lib/estudios.ts"

type Definiciones = {
  fuente: string
  corte: string
  primer_mes: string
  ultimo_mes: string
  responsable_validacion: string
  estado_definicion: string
  metricas: Record<string, { nombre: string; formula: string; unidad: string; definicion_unica?: boolean }>
  definiciones_historicas: { id: string; reporte: string; formula: string; diferencia: string }[]
  canales: string[]
  regiones: string[]
}
const definiciones = (ctx: ToolCtx) => JSON.parse(readFileSync(rutas(ctx.directory).definiciones, "utf8")) as Definiciones

/** Ficha de trazabilidad que acompaña cada cifra. */
function ficha(ctx: ToolCtx, metrica: Metrica, args: unknown) {
  const d = definiciones(ctx)
  const m = d.metricas[metrica]
  return {
    fuente: d.fuente,
    corte: d.corte,
    metrica: m?.nombre ?? metrica,
    definicion: m?.formula ?? "",
    responsable_validacion: d.responsable_validacion,
    estado_definicion: d.estado_definicion,
    consulta_id: createHash("sha256").update(JSON.stringify(args)).digest("hex").slice(0, 10),
  }
}

const mes = (desc: string) => z.string().regex(MES_VALIDO, "Formato AAAA-MM").describe(desc)

// ---------------------------------------------------------------------------------------------

export const dimensiones: Herramienta<Record<string, never>> = {
  description: "Lista lo que el copiloto puede responder: métricas, canales, regiones, meses disponibles y corte de datos. Úsala ante preguntas sobre el alcance o si dudas de un nombre.",
  args: {},
  execute: seguro(async (_a, ctx) => {
    const d = definiciones(ctx)
    return ok({
      metricas: Object.entries(d.metricas).map(([k, v]) => ({ id: k, nombre: v.nombre, formula: v.formula })),
      canales: d.canales,
      regiones: d.regiones,
      meses_disponibles: { desde: d.primer_mes, hasta: d.ultimo_mes },
      corte: d.corte,
      estudios_internos: listarEstudios(rutas(ctx.directory).estudios),
      fuera_de_alcance: ["otras marcas", "margen y costos", "pronósticos", "datos posteriores al corte", "datos de clientes individuales"],
    })
  }),
}

const argsConsulta = {
  metrica: z.enum(METRICAS).describe("ventas_netas (definición única: brutas − descuentos − devoluciones), ventas_brutas, descuentos, devoluciones, unidades o descuento_pct (descuentos / brutas)"),
  desde: mes("Primer mes del periodo, AAAA-MM. Ej.: 2026-07"),
  hasta: mes("Último mes del periodo, AAAA-MM. Ej.: 2026-09"),
  agrupar_por: z.enum(AGRUPACIONES).default("total").describe("total, mes, trimestre, anio, canal o region"),
  canal: z.string().optional().describe("Filtra por canal: Tradicional, Moderno, Mayorista o Digital"),
  region: z.string().optional().describe("Filtra por región: Centro, Antioquia y Eje Cafetero, Caribe, Pacífico u Oriente"),
  comparar_con: z.enum(COMPARACIONES).default("ninguna").describe("ninguna, periodo_anterior (mismo número de meses justo antes) o mismo_periodo_anio_anterior"),
}

export const consultar_ventas: Herramienta<typeof argsConsulta> = {
  description:
    "Consulta la tabla validada de ventas de Brío y devuelve las cifras ya calculadas y formateadas, con su ficha de trazabilidad (fuente, corte, definición, responsable). Es la única forma de obtener cifras. Si el dato no existe, responde con un error que debes transmitir como 'no tengo el dato'.",
  args: argsConsulta,
  execute: seguro(async (args, ctx) => {
    const d = definiciones(ctx)
    const r = consultar(cargarVentas(rutas(ctx.directory).ventas), args, { primer: d.primer_mes, ultimo: d.ultimo_mes, canales: d.canales, regiones: d.regiones })
    if (typeof r === "string") return fail(r)
    return ok({ ...r, ficha: ficha(ctx, args.metrica, args) })
  }),
}

const argsDefinicion = {
  comparar_desde: mes("Opcional: primer mes para cuantificar las diferencias entre definiciones").optional(),
  comparar_hasta: mes("Opcional: último mes para cuantificar las diferencias entre definiciones").optional(),
}

export const definicion: Herramienta<typeof argsDefinicion> = {
  description:
    "Explica la definición única de ventas netas y las definiciones distintas que usaban los reportes de Comercial, Mercadeo y Finanzas. Con un periodo, cuantifica cuánto difiere cada reporte. Úsala cuando pregunten por qué dos reportes dan cifras distintas.",
  args: argsDefinicion,
  execute: seguro(async (args, ctx) => {
    const d = definiciones(ctx)
    const base = { definicion_unica: d.metricas.ventas_netas, estado: d.estado_definicion, historicas: d.definiciones_historicas, responsable_validacion: d.responsable_validacion, corte: d.corte }
    if (!args.comparar_desde && !args.comparar_hasta) return ok(base)
    const desde = args.comparar_desde ?? args.comparar_hasta!, hasta = args.comparar_hasta ?? args.comparar_desde!
    if (desde > hasta) return fail("El mes inicial es posterior al mes final.")
    if (desde < d.primer_mes || hasta > d.ultimo_mes) return fail(`No tengo ese dato: la tabla validada cubre de ${d.primer_mes} a ${d.ultimo_mes}.`)
    return ok({ ...base, periodo: { desde, hasta }, comparacion: compararDefiniciones(cargarVentas(rutas(ctx.directory).ventas), desde, hasta), ficha: ficha(ctx, "ventas_netas", args) })
  }),
}

const argsEstudios = {
  consulta: z.string().min(3).max(200).describe("Tema a buscar en los estudios internos de consumidor, en palabras clave. Ej.: 'precio canal tradicional', 'Caribe hogares'"),
  max_resultados: z.number().int().min(1).max(5).default(3),
}

export const buscar_estudios: Herramienta<typeof argsEstudios> = {
  description:
    "Busca en los estudios INTERNOS de consumidor de Brío y devuelve fragmentos textuales exactos con estudio, sección y fecha. Cita solo lo que devuelva; nunca resumas un estudio que no hayas recibido. Si no hay fragmentos relevantes, di que no hay evidencia en los estudios disponibles.",
  args: argsEstudios,
  execute: seguro(async (args, ctx) => {
    const frags = buscarFragmentos(rutas(ctx.directory).estudios, args.consulta, args.max_resultados)
    if (!frags.length) return fail(`No encontré fragmentos sobre "${args.consulta}" en los estudios internos disponibles.`)
    return ok({ fragmentos: frags, nota: "Fragmentos textuales; cita estudio y sección." })
  }),
}

// Verificador de cifras: revisa cada número del texto del copiloto contra los resultados de las herramientas
// del mismo turno (y la pregunta del usuario). Si una cifra no tiene respaldo, se marca como NO verificada.
// Es un control del servidor: no depende de que el modelo obedezca el prompt.

const NUMERO = /-?\d{1,3}(?:\.\d{3})+(?:,\d+)?|-?\d+(?:,\d+)?/g

/** "36.000,0" → 36000 ; "-7,9" → -7.9 ; "2026" → 2026 */
export function aNumero(s: string): number {
  return Number(s.replace(/\./g, "").replace(",", "."))
}

export function extraerNumeros(texto: string): { crudo: string; valor: number; esPct: boolean }[] {
  const out: { crudo: string; valor: number; esPct: boolean }[] = []
  for (const m of texto.matchAll(NUMERO)) {
    const crudo = m[0]
    const despues = texto.slice((m.index ?? 0) + crudo.length, (m.index ?? 0) + crudo.length + 3)
    const antes = texto.slice(Math.max(0, (m.index ?? 0) - 1), m.index ?? 0)
    if (/[A-Za-z]/.test(antes)) continue // parte de un identificador: T3, Q3, PBI-01
    out.push({ crudo, valor: aNumero(crudo), esPct: /^\s?(%|pp)/.test(despues) })
  }
  return out
}

/** Recolecta todos los números que aparecen en los resultados (strings formateados y valores crudos). */
function respaldos(fuentes: unknown[]): number[] {
  const nums: number[] = []
  const visitar = (x: unknown) => {
    if (typeof x === "number") {
      nums.push(x, x / 1e6, x / 1e9, x * 100, x / 1e3)
    } else if (typeof x === "string") {
      for (const n of extraerNumeros(x)) nums.push(n.valor)
    } else if (Array.isArray(x)) x.forEach(visitar)
    else if (x && typeof x === "object") Object.values(x).forEach(visitar)
  }
  fuentes.forEach(visitar)
  return nums
}

const ignorable = (n: { valor: number; esPct: boolean }) =>
  (!n.esPct && Number.isInteger(n.valor) && Math.abs(n.valor) <= 31) || // días, meses, trimestres, conteos pequeños
  (!n.esPct && n.valor >= 2000 && n.valor <= 2100 && Number.isInteger(n.valor)) // años

export type Verificacion = { cifras: number; verificadas: number; no_verificadas: string[] }

export function verificarCifras(texto: string, resultadosHerramientas: string[], mensajeUsuario = ""): Verificacion {
  const fuentes = resultadosHerramientas.map((r) => {
    try {
      return JSON.parse(r) as unknown
    } catch {
      return r
    }
  })
  const base = respaldos([...fuentes, mensajeUsuario])
  const candidatos = extraerNumeros(texto).filter((n) => !ignorable(n))
  const no: string[] = []
  for (const n of candidatos) {
    const v = Math.abs(n.valor)
    // tolerancia por redondeo a un decimal (o a entero si el texto no trae decimales)
    const tol = n.crudo.includes(",") ? 0.051 : 0.51
    const ok = base.some((b) => Math.abs(Math.abs(b) - v) <= tol || Math.abs(Math.abs(b) - v) <= v * 0.0005)
    if (!ok) no.push(n.crudo + (n.esPct ? " %" : ""))
  }
  return { cifras: candidatos.length, verificadas: candidatos.length - no.length, no_verificadas: [...new Set(no)] }
}

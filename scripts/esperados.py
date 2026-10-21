"""Batería de preguntas de referencia con respuestas esperadas calculadas A MANO (en Python, sin usar
el código TypeScript del copiloto). demo.ts compara las herramientas contra estos valores: deben dar
0 diferencias. Salida: datos/bateria.json
"""
import csv, json, os
RAIZ = os.path.join(os.path.dirname(__file__), "..")
filas = list(csv.DictReader(open(os.path.join(RAIZ, "datos", "ventas_brio_validada.csv"), encoding="utf-8")))
for f in filas:
    for k in ("ventas_brutas_cop", "descuentos_cop", "devoluciones_cop", "ventas_netas_cop", "unidades"):
        f[k] = int(f[k])

def miles(s): 
    e, _, d = s.partition(".")
    neg = e.startswith("-"); e = e.lstrip("-")
    g = ""
    while len(e) > 3: g = "." + e[-3:] + g; e = e[:-3]
    return ("-" if neg else "") + e + g + ("," + d if d else "")
cop = lambda v: f"COP {miles(f'{v/1e6:.1f}')} M"
var = lambda x: ("+" if x >= 0 else "") + miles(f"{x*100:.1f}") + " %"
pp = lambda x: ("+" if x >= 0 else "") + miles(f"{x*100:.1f}") + " pp"
uni = lambda v: f"{miles(str(v))} unidades"

def meses(d, h):
    out, a, m = [], int(d[:4]), int(d[5:])
    while f"{a}-{m:02d}" <= h:
        out.append(f"{a}-{m:02d}"); m += 1
        if m == 13: a, m = a + 1, 1
    return out
def suma(k, ms, **flt):
    return sum(f[k] for f in filas if f["mes"] in ms and all(f[c] == v for c, v in flt.items()))

T3_25, T3_26 = meses("2025-07", "2025-09"), meses("2026-07", "2026-09")
Y25, Y26 = meses("2025-01", "2025-09"), meses("2026-01", "2026-09")
CANALES = ["Tradicional", "Moderno", "Mayorista", "Digital"]
REGIONES = ["Centro", "Antioquia y Eje Cafetero", "Caribe", "Pacífico", "Oriente"]
N = "ventas_netas_cop"
b = []
def q(id, pregunta, tipo, consulta=None, esperado=None, nota=""):
    b.append({"id": id, "pregunta": pregunta, "tipo": tipo, "consulta": consulta, "esperado": esperado, "nota": nota})

q("C01", "¿Cuánto vendió Brío en ventas netas en 2025?", "cifra",
  {"herramienta": "brio_consultar_ventas", "args": {"metrica": "ventas_netas", "desde": "2025-01", "hasta": "2025-12", "agrupar_por": "total", "comparar_con": "ninguna"}},
  {"total": {"valor_fmt": cop(suma(N, meses("2025-01", "2025-12")))}}, "Debe cuadrar con COP 36.000 M del archivo 03")
v26, v25 = suma(N, T3_26), suma(N, T3_25)
q("C02", "¿Cuánto vendió Brío en ventas netas en el tercer trimestre de 2026 frente al mismo trimestre de 2025?", "cifra",
  {"herramienta": "brio_consultar_ventas", "args": {"metrica": "ventas_netas", "desde": "2026-07", "hasta": "2026-09", "agrupar_por": "total", "comparar_con": "mismo_periodo_anio_anterior"}},
  {"total": {"valor_fmt": cop(v26), "comparado_fmt": cop(v25), "variacion_fmt": var(v26 / v25 - 1)}})
q("C03", "¿Cómo cambiaron las ventas netas por canal de enero a septiembre de 2026 frente al mismo periodo de 2025?", "cifra",
  {"herramienta": "brio_consultar_ventas", "args": {"metrica": "ventas_netas", "desde": "2026-01", "hasta": "2026-09", "agrupar_por": "canal", "comparar_con": "mismo_periodo_anio_anterior"}},
  {"total": {"valor_fmt": cop(suma(N, Y26)), "comparado_fmt": cop(suma(N, Y25)), "variacion_fmt": var(suma(N, Y26) / suma(N, Y25) - 1)},
   "filas": {c: {"valor_fmt": cop(suma(N, Y26, canal=c)), "variacion_fmt": var(suma(N, Y26, canal=c) / suma(N, Y25, canal=c) - 1)} for c in CANALES}})
caidas = {r: suma(N, T3_26, region=r) / suma(N, T3_25, region=r) - 1 for r in REGIONES}
q("C04", "¿Qué región cayó más en ventas netas en el tercer trimestre de 2026 frente al de 2025?", "cifra",
  {"herramienta": "brio_consultar_ventas", "args": {"metrica": "ventas_netas", "desde": "2026-07", "hasta": "2026-09", "agrupar_por": "region", "comparar_con": "mismo_periodo_anio_anterior"}},
  {"total": {"valor_fmt": cop(v26), "variacion_fmt": var(v26 / v25 - 1)}, "filas": {r: {"valor_fmt": cop(suma(N, T3_26, region=r)), "variacion_fmt": var(x)} for r, x in caidas.items()}, "mayor_caida": min(caidas, key=caidas.get)})
d26 = suma("descuentos_cop", Y26) / suma("ventas_brutas_cop", Y26); d25 = suma("descuentos_cop", Y25) / suma("ventas_brutas_cop", Y25)
q("C05", "¿Cuánto pesan los descuentos sobre las ventas brutas de enero a septiembre de 2026 frente a 2025?", "cifra",
  {"herramienta": "brio_consultar_ventas", "args": {"metrica": "descuento_pct", "desde": "2026-01", "hasta": "2026-09", "agrupar_por": "total", "comparar_con": "mismo_periodo_anio_anterior"}},
  {"total": {"valor_fmt": miles(f"{d26*100:.1f}") + " %", "comparado_fmt": miles(f"{d25*100:.1f}") + " %", "variacion_fmt": pp(d26 - d25)}})
q("C06", "¿Cuánto vendió Brío en el canal tradicional del Caribe en agosto de 2026?", "cifra",
  {"herramienta": "brio_consultar_ventas", "args": {"metrica": "ventas_netas", "desde": "2026-08", "hasta": "2026-08", "agrupar_por": "total", "canal": "tradicional", "region": "caribe", "comparar_con": "ninguna"}},
  {"total": {"valor_fmt": cop(suma(N, ["2026-08"], canal="Tradicional", region="Caribe"))}})
q("C07", "¿Cuánto sumaron las devoluciones de Brío en 2025?", "cifra",
  {"herramienta": "brio_consultar_ventas", "args": {"metrica": "devoluciones", "desde": "2025-01", "hasta": "2025-12", "agrupar_por": "total", "comparar_con": "ninguna"}},
  {"total": {"valor_fmt": cop(suma("devoluciones_cop", meses("2025-01", "2025-12")))}})
q("C08", "¿Cómo fueron las ventas netas mes a mes en el tercer trimestre de 2026?", "cifra",
  {"herramienta": "brio_consultar_ventas", "args": {"metrica": "ventas_netas", "desde": "2026-07", "hasta": "2026-09", "agrupar_por": "mes", "comparar_con": "ninguna"}},
  {"total": {"valor_fmt": cop(v26)}, "filas": {m: {"valor_fmt": cop(suma(N, [m]))} for m in T3_26}})
q("C09", "¿Cuántas unidades vendió Brío en el canal digital de enero a septiembre de 2026?", "cifra",
  {"herramienta": "brio_consultar_ventas", "args": {"metrica": "unidades", "desde": "2026-01", "hasta": "2026-09", "agrupar_por": "total", "canal": "Digital", "comparar_con": "ninguna"}},
  {"total": {"valor_fmt": uni(suma("unidades", Y26, canal="Digital"))}})
A = meses("2025-01", "2025-12"); br, de, dv = suma("ventas_brutas_cop", A), suma("descuentos_cop", A), suma("devoluciones_cop", A)
q("D01", "¿Por qué el reporte de Comercial y el de Finanzas dan cifras distintas de ventas netas en 2025?", "definicion",
  {"herramienta": "brio_definicion", "args": {"comparar_desde": "2025-01", "comparar_hasta": "2025-12"}},
  {"comparacion": {"finanzas": cop(br - de - dv), "comercial": cop(br - de), "mercadeo": cop(br), "diferencia_comercial": cop(dv), "diferencia_mercadeo": cop(de + dv)}})
q("F01", "¿Cuánto vendió Brío en octubre de 2026?", "fuera_de_alcance",
  {"herramienta": "brio_consultar_ventas", "args": {"metrica": "ventas_netas", "desde": "2026-10", "hasta": "2026-10", "agrupar_por": "total", "comparar_con": "ninguna"}},
  {"error_contiene": "No tengo ese dato"}, "Posterior al corte")
q("F02", "¿Cuánto vendió Brío en el canal de farmacias en 2025?", "fuera_de_alcance",
  {"herramienta": "brio_consultar_ventas", "args": {"metrica": "ventas_netas", "desde": "2025-01", "hasta": "2025-12", "agrupar_por": "total", "canal": "Farmacias", "comparar_con": "ninguna"}},
  {"error_contiene": "No tengo el canal"}, "Canal inexistente")
q("F03", "¿Cuál fue el margen de Brío por canal en 2025?", "fuera_de_alcance", None, None, "Métrica no disponible: el copiloto debe decir que no tiene el dato (solo con modelo)")
q("F04", "¿Cuánto vendió la marca Vita en 2025?", "fuera_de_alcance", None, None, "Otra marca: el copiloto debe decir que no tiene el dato (solo con modelo)")
q("F05", "¿Cuánto venderá Brío en el cuarto trimestre de 2026?", "fuera_de_alcance", None, None, "Pronóstico: fuera de alcance (solo con modelo)")
q("E01", "¿Qué dicen los estudios internos sobre el precio en el canal tradicional?", "estudio",
  {"herramienta": "brio_buscar_estudios", "args": {"consulta": "precio canal tradicional", "max_resultados": 3}},
  {"estudio_contiene": "Test de precio y promoción"})
q("E02", "¿Qué pasa con los hogares del Caribe según los estudios?", "estudio",
  {"herramienta": "brio_buscar_estudios", "args": {"consulta": "hogares Caribe penetración", "max_resultados": 3}},
  {"estudio_contiene": "Panel de hogares región Caribe"})
q("E03", "¿Qué dicen los estudios sobre influenciadores en redes sociales?", "fuera_de_alcance",
  {"herramienta": "brio_buscar_estudios", "args": {"consulta": "influenciadores redes sociales", "max_resultados": 3}},
  {"error_contiene": "No encontré fragmentos"}, "Sin evidencia en estudios")
json.dump({"descripcion": "Batería de preguntas de referencia. Esperados calculados en Python, independientes del código del copiloto.", "preguntas": b},
          open(os.path.join(RAIZ, "datos", "bateria.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(len(b), "preguntas · mayor caída T3:", min(caidas, key=caidas.get), {k: round(v * 100, 1) for k, v in caidas.items()})

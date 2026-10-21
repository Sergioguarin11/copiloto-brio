"""Genera la tabla validada SINTÉTICA de ventas de Brío (datos/ventas_brio_validada.csv).
Reproducible (semilla fija). Las ventas netas de 2025 suman exactamente COP 36.000.000.000,
igual al dato confirmado de 03_Baselines_y_Valor.xlsx (hoja Negocio y alcance).
Definición única: ventas_netas = ventas_brutas - descuentos - devoluciones.
"""
import csv, random, os
random.seed(20261021)
CANALES = {"Tradicional": .52, "Moderno": .28, "Mayorista": .14, "Digital": .06}
REGIONES = {"Centro": .34, "Antioquia y Eje Cafetero": .22, "Caribe": .18, "Pacífico": .14, "Oriente": .12}
ESTACIONAL = [0.93, 0.90, 0.97, 0.98, 1.00, 0.99, 1.01, 1.02, 0.99, 1.03, 1.06, 1.12]
TEND_CANAL = {"Tradicional": -0.09, "Moderno": -0.02, "Mayorista": -0.05, "Digital": 0.18}
TEND_REGION = {"Centro": 0.0, "Antioquia y Eje Cafetero": 0.0, "Caribe": -0.06, "Pacífico": -0.02, "Oriente": 0.01}
PRECIO_UNIDAD = 4800
meses = [f"2025-{m:02d}" for m in range(1, 13)] + [f"2026-{m:02d}" for m in range(1, 10)]
filas = []
for mes in meses:
    anio, m = int(mes[:4]), int(mes[5:])
    for c, sc in CANALES.items():
        for r, sr in REGIONES.items():
            base = 3_000_000_000 * ESTACIONAL[m - 1] / (sum(ESTACIONAL) / 12) * sc * sr
            if anio == 2026:
                # el deterioro se profundiza a lo largo del año
                avance = m / 9
                base *= 1 + (TEND_CANAL[c] + TEND_REGION[r]) * (0.6 + 0.8 * avance)
            base *= 1 + random.uniform(-0.03, 0.03)
            d = (0.080 if anio == 2025 else 0.105) + random.uniform(-0.006, 0.006)
            v = 0.015 + random.uniform(-0.003, 0.003)
            filas.append([mes, c, r, base, d, v])
# escalar 2025 para que la neta sume exactamente 36.000 M
neto25 = sum(f[3] for f in filas if f[0].startswith("2025"))
k = 36_000_000_000 / neto25
salida = []
for mes, c, r, net, d, v in filas:
    net *= k
    brutas = round(net / (1 - d - v))
    desc = round(brutas * d)
    dev = round(brutas * v)
    salida.append([mes, c, r, brutas, desc, dev])
total25 = sum(b - de - dv for mes, c, r, b, de, dv in salida if mes.startswith("2025"))
resid = 36_000_000_000 - total25
ultimo = max(i for i, f in enumerate(salida) if f[0].startswith("2025"))
salida[ultimo][3] += resid
ruta = os.path.join(os.path.dirname(__file__), "..", "datos", "ventas_brio_validada.csv")
with open(ruta, "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh)
    w.writerow(["mes", "canal", "region", "ventas_brutas_cop", "descuentos_cop", "devoluciones_cop", "ventas_netas_cop", "unidades"])
    for mes, c, r, b, de, dv in salida:
        neta = b - de - dv
        w.writerow([mes, c, r, b, de, dv, neta, round(neta / PRECIO_UNIDAD)])
print("filas", len(salida), "neta 2025", sum(b - de - dv for mes, c, r, b, de, dv in salida if mes.startswith("2025")))

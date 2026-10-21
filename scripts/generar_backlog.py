"""Genera backlog/backlog.json (fuente única del backlog) a partir de scripts/pbis.py, la misma lista
de PBIs con horas mín/probable/máx que usa el anexo de cálculos (hoja PBIs)."""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from pbis import PBIS
ROLES = {"Datos": "Responsable de Datos", "Ingeniería": "analista de Mercadeo de Brío", "Seguridad": "Responsable de Seguridad"}
def pbi(p, estado="New"):
    pid, fr, area, tit, para, crit, pts, ing, dat, seg, exp, nota = p
    horas = {k: {"min": v[0], "prob": v[1], "max": v[2]} for k, v in (("ingenieria", ing), ("datos", dat), ("seguridad", seg), ("expertos", exp)) if any(v)}
    quien = "Ingeniero de Producto IA" if area == "Ingeniería" and fr != "IA-01" else ROLES[area]
    return {"titulo": f"{pid} · {tit}", "historia": f"Como {quien}, quiero {tit[0].lower() + tit[1:]}, para {para[0].lower() + para[1:]}.",
            "criterios": [crit] + ([nota] if nota else []), "esfuerzo": pts, "prioridad": 1 if fr == "IA-01" else 2,
            "valor": 100 if fr == "IA-01" else 60, "estado": estado, "tags": [fr, area] + (["Condicionado"] if fr == "IA-04" else []), "area": area, "horas": horas}
por = lambda fr, area=None: [pbi(p) for p in PBIS if p[1] == fr and (area is None or p[2] == area)]
proto = [
    {"titulo": "PROTO-01 · Tabla validada sintética de ventas de Brío", "historia": "Como Ingeniero de Producto IA, quiero una tabla de ventas sintética con la definición única, para demostrar el copiloto sin datos reales.", "criterios": ["Ventas netas 2025 = COP 36.000 M, igual al dato confirmado del archivo 03", "Neta = brutas − descuentos − devoluciones en cada fila"], "esfuerzo": 3, "prioridad": 1, "valor": 80, "estado": "Done", "tags": ["Prototipo"]},
    {"titulo": "PROTO-02 · Herramientas de consulta y ficha de trazabilidad", "historia": "Como analista, quiero que cada cifra venga de una consulta con fuente, corte y definición, para confiar en ella.", "criterios": ["La IA no calcula cifras: las devuelve la herramienta ya formateadas", "Fuera de corte o dimensión inexistente: 'no tengo el dato'"], "esfuerzo": 8, "prioridad": 1, "valor": 100, "estado": "Done", "tags": ["Prototipo"]},
    {"titulo": "PROTO-03 · Verificador de cifras en el servidor", "historia": "Como analista, quiero que el sistema marque cualquier cifra del texto sin respaldo, para no usar números inventados.", "criterios": ["Una respuesta fiel pasa; una cifra inventada se detecta (demo.ts V01 y V02)"], "esfuerzo": 5, "prioridad": 1, "valor": 100, "estado": "Done", "tags": ["Prototipo"]},
    {"titulo": "PROTO-04 · Batería de referencia validada contra cálculo manual", "historia": "Como Ingeniero de Producto IA, quiero comparar las herramientas con un cálculo manual independiente, para salir al piloto con 0 diferencias.", "criterios": ["18 preguntas; esperados calculados en Python", "demo.ts: 0 diferencias"], "esfuerzo": 5, "prioridad": 1, "valor": 90, "estado": "Done", "tags": ["Prototipo"]},
    {"titulo": "PROTO-05 · Canales web y Telegram con retroalimentación", "historia": "Como analista, quiero preguntar desde la web o Telegram y marcar si la respuesta fue útil, para medir utilidad en el piloto.", "criterios": ["Telegram con lista blanca de usuarios", "Botones útil / tiene un error registrados en out/feedback.jsonl"], "esfuerzo": 5, "prioridad": 2, "valor": 60, "estado": "Done", "tags": ["Prototipo"]},
    {"titulo": "PROTO-06 · Prueba real con IA sobre la batería", "historia": "Como Ingeniero de Producto IA, quiero correr la batería por el copiloto completo con el modelo, para documentar qué funciona y qué no.", "criterios": ["out/evaluacion.md con consulta correcta, exactitud, honestidad y cifras sin respaldo"], "esfuerzo": 3, "prioridad": 1, "valor": 90, "estado": "Committed", "tags": ["Prototipo", "Evidencia"]},
]
b = {"producto": "Copiloto de análisis Brío con cifras confiables", "proceso": "Scrum", "repositorio": "https://github.com/Sergioguarin11/copiloto-brio", "epicas": [
    {"clave": "E0", "titulo": "Prototipo para la prueba (datos sintéticos)", "descripcion": "Demostración funcional del copiloto con datos sintéticos, validada contra cálculo manual y probada con IA.", "estado": "In Progress",
     "features": [{"clave": "F0.1", "titulo": "Prototipo funcional y evidencia", "estado": "In Progress", "pbis": proto}]},
    {"clave": "E1", "titulo": "IA-01 · Copiloto de análisis Brío – Mercadeo", "descripcion": "Copiloto que responde preguntas de ventas de Brío con cifras trazables sobre una definición única de ventas netas. Meta: −20 % de horas de análisis (umbral −10 %), 100 % de exactitud, 60 % de uso útil.", "estado": "New",
     "features": [{"clave": "F1.1", "titulo": "Base de cifras confiables (Datos)", "estado": "New", "pbis": por("IA-01", "Datos")},
                  {"clave": "F1.2", "titulo": "Copiloto y piloto con medición (Ingeniería)", "estado": "New", "pbis": por("IA-01", "Ingeniería")},
                  {"clave": "F1.3", "titulo": "Controles de seguridad (Seguridad)", "estado": "New", "pbis": por("IA-01", "Seguridad")}]},
    {"clave": "E2", "titulo": "Experimentos en paralelo para Dirección", "descripcion": "Validar antes de construir los pedidos del CEO: promociones (IA-02), decisiones (IA-05) y creatividad condicionada (IA-04).", "estado": "New",
     "features": [{"clave": "F2.1", "titulo": "IA-02 · Experimento de promociones por región", "estado": "New", "pbis": por("IA-02")},
                  {"clave": "F2.2", "titulo": "IA-05 · Validación del asistente de decisiones", "estado": "New", "pbis": por("IA-05")},
                  {"clave": "F2.3", "titulo": "IA-04 · Prueba creativa (condicionada)", "estado": "New", "pbis": por("IA-04")}]}]}
json.dump(b, open(os.path.join(os.path.dirname(__file__), "..", "backlog", "backlog.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(sum(len(f["pbis"]) for e in b["epicas"] for f in e["features"]), "PBIs")

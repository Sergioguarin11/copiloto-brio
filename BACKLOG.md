# Backlog del producto — Copiloto de análisis Brío con cifras confiables

Proceso **Scrum** (Épica → Feature → Product Backlog Item). Fuente única: `backlog/backlog.json`, cargada también en Azure DevOps con `bun run backlog cargar`.

**Avance:** 5 de 30 PBIs terminados · 26 de 169 puntos de esfuerzo.

| Épica | Estado | PBIs | Puntos |
|---|---|---|---|
| E0 · Prototipo para la prueba (datos sintéticos) | In Progress | 6 | 29 |
| E1 · IA-01 · Copiloto de análisis Brío – Mercadeo | New | 17 | 105 |
| E2 · Experimentos en paralelo para Dirección | New | 7 | 35 |

## E0 · Prototipo para la prueba (datos sintéticos)

_In Progress._ Demostración funcional del copiloto con datos sintéticos, validada contra cálculo manual y probada con IA.

### F0.1 · Prototipo funcional y evidencia

#### ✅ PROTO-01 · Tabla validada sintética de ventas de Brío

Como Ingeniero de Producto IA, quiero una tabla de ventas sintética con la definición única, para demostrar el copiloto sin datos reales.

**Estado:** Done · **Esfuerzo:** 3 · **Prioridad:** 1 · **Valor de negocio:** 80 · `Prototipo`

Criterios de aceptación:
- Ventas netas 2025 = COP 36.000 M, igual al dato confirmado del archivo 03
- Neta = brutas − descuentos − devoluciones en cada fila

#### ✅ PROTO-02 · Herramientas de consulta y ficha de trazabilidad

Como analista, quiero que cada cifra venga de una consulta con fuente, corte y definición, para confiar en ella.

**Estado:** Done · **Esfuerzo:** 8 · **Prioridad:** 1 · **Valor de negocio:** 100 · `Prototipo`

Criterios de aceptación:
- La IA no calcula cifras: las devuelve la herramienta ya formateadas
- Fuera de corte o dimensión inexistente: 'no tengo el dato'

#### ✅ PROTO-03 · Verificador de cifras en el servidor

Como analista, quiero que el sistema marque cualquier cifra del texto sin respaldo, para no usar números inventados.

**Estado:** Done · **Esfuerzo:** 5 · **Prioridad:** 1 · **Valor de negocio:** 100 · `Prototipo`

Criterios de aceptación:
- Una respuesta fiel pasa; una cifra inventada se detecta (demo.ts V01 y V02)

#### ✅ PROTO-04 · Batería de referencia validada contra cálculo manual

Como Ingeniero de Producto IA, quiero comparar las herramientas con un cálculo manual independiente, para salir al piloto con 0 diferencias.

**Estado:** Done · **Esfuerzo:** 5 · **Prioridad:** 1 · **Valor de negocio:** 90 · `Prototipo`

Criterios de aceptación:
- 18 preguntas; esperados calculados en Python
- demo.ts: 0 diferencias

#### ✅ PROTO-05 · Canales web y Telegram con retroalimentación

Como analista, quiero preguntar desde la web o Telegram y marcar si la respuesta fue útil, para medir utilidad en el piloto.

**Estado:** Done · **Esfuerzo:** 5 · **Prioridad:** 2 · **Valor de negocio:** 60 · `Prototipo`

Criterios de aceptación:
- Telegram con lista blanca de usuarios
- Botones útil / tiene un error registrados en out/feedback.jsonl

#### 🔄 PROTO-06 · Prueba real con IA sobre la batería

Como Ingeniero de Producto IA, quiero correr la batería por el copiloto completo con el modelo, para documentar qué funciona y qué no.

**Estado:** Committed · **Esfuerzo:** 3 · **Prioridad:** 1 · **Valor de negocio:** 90 · `Prototipo` `Evidencia`

Criterios de aceptación:
- out/evaluacion.md con consulta correcta, exactitud, honestidad y cifras sin respaldo

## E1 · IA-01 · Copiloto de análisis Brío – Mercadeo

_New._ Copiloto que responde preguntas de ventas de Brío con cifras trazables sobre una definición única de ventas netas. Meta: −20 % de horas de análisis (umbral −10 %), 100 % de exactitud, 60 % de uso útil.

### F1.1 · Base de cifras confiables (Datos)

#### ⬜ PBI-01 · Acordar la definición única de ventas netas

Como Responsable de Datos, quiero acordar la definición única de ventas netas, para que todos usen la misma cifra.

**Estado:** New · **Esfuerzo:** 5 · **Prioridad:** 1 · **Valor de negocio:** 100 · `IA-01` `Datos`

**Horas (mín / probable / máx):** datos 4 / 6 / 8 · expertos 1 / 2 / 3

Criterios de aceptación:
- Definición firmada por Mercadeo, Comercial, Finanzas y Datos
- Comercial y Finanzas: 2-4 h

#### ⬜ PBI-02 · Inventariar fuentes de ventas de Brío y mapearlas a la definición

Como Responsable de Datos, quiero inventariar fuentes de ventas de Brío y mapearlas a la definición, para saber de dónde sale cada cifra.

**Estado:** New · **Esfuerzo:** 3 · **Prioridad:** 1 · **Valor de negocio:** 100 · `IA-01` `Datos`

**Horas (mín / probable / máx):** datos 3 / 4 / 6

Criterios de aceptación:
- Inventario con fuente, dueño y corte por cada fuente

#### ⬜ PBI-03 · Construir la tabla validada de ventas de Brío

Como Responsable de Datos, quiero construir la tabla validada de ventas de Brío, para tener una sola fuente confiable.

**Estado:** New · **Esfuerzo:** 8 · **Prioridad:** 1 · **Valor de negocio:** 100 · `IA-01` `Datos`

**Horas (mín / probable / máx):** ingenieria 2 / 4 / 6 · datos 6 / 8 / 12

Criterios de aceptación:
- Tabla cuadra 100 % con el cierre de Finanzas en una muestra de meses
- Alcance de meses y canales [Por confirmar]

#### ⬜ PBI-04 · Implementar reglas de calidad sobre la tabla (absorbe IA-03)

Como Responsable de Datos, quiero implementar reglas de calidad sobre la tabla (absorbe IA-03), para detectar errores antes de que lleguen a un informe.

**Estado:** New · **Esfuerzo:** 5 · **Prioridad:** 1 · **Valor de negocio:** 100 · `IA-01` `Datos`

**Horas (mín / probable / máx):** datos 3 / 5 / 7

Criterios de aceptación:
- Reglas activas y alertas registradas con causa
- IA-03 sin IA

#### ⬜ PBI-05 · Dar soporte de datos durante el piloto

Como Responsable de Datos, quiero dar soporte de datos durante el piloto, para resolver dudas de cifras a tiempo.

**Estado:** New · **Esfuerzo:** 3 · **Prioridad:** 1 · **Valor de negocio:** 100 · `IA-01` `Datos`

**Horas (mín / probable / máx):** datos 2 / 4 / 6

Criterios de aceptación:
- Dudas atendidas en menos de 1 día hábil

### F1.2 · Copiloto y piloto con medición (Ingeniería)

#### ⬜ PBI-06 · Definir criterios de aceptación y la batería de preguntas de referencia

Como analista de Mercadeo de Brío, quiero definir criterios de aceptación y la batería de preguntas de referencia, para saber qué es una respuesta correcta.

**Estado:** New · **Esfuerzo:** 5 · **Prioridad:** 1 · **Valor de negocio:** 100 · `IA-01` `Ingeniería`

**Horas (mín / probable / máx):** ingenieria 6 / 8 / 10 · expertos 2 / 3 / 4

Criterios de aceptación:
- Batería aprobada por Mercadeo con respuesta correcta calculada a mano

#### ⬜ PBI-07 · Configurar el acceso al modelo de IA aprobado y el entorno

Como analista de Mercadeo de Brío, quiero configurar el acceso al modelo de IA aprobado y el entorno, para poder construir sobre una herramienta permitida.

**Estado:** New · **Esfuerzo:** 3 · **Prioridad:** 1 · **Valor de negocio:** 100 · `IA-01` `Ingeniería`

**Horas (mín / probable / máx):** ingenieria 4 / 6 / 10

Criterios de aceptación:
- Entorno funcionando con el modelo aprobado por Seguridad
- Depende de aprobación del modelo

#### ⬜ PBI-08 · Construir la capa que convierte la pregunta en consulta sobre la tabla validada

Como analista de Mercadeo de Brío, quiero construir la capa que convierte la pregunta en consulta sobre la tabla validada, para que la IA no calcule cifras.

**Estado:** New · **Esfuerzo:** 13 · **Prioridad:** 1 · **Valor de negocio:** 100 · `IA-01` `Ingeniería`

**Horas (mín / probable / máx):** ingenieria 24 / 32 / 45

Criterios de aceptación:
- 90 % de la batería genera la consulta correcta
- Núcleo técnico

#### ⬜ PBI-09 · Construir la ficha de trazabilidad y la respuesta 'no tengo el dato'

Como analista de Mercadeo de Brío, quiero construir la ficha de trazabilidad y la respuesta 'no tengo el dato', para que el analista confíe en cada cifra.

**Estado:** New · **Esfuerzo:** 8 · **Prioridad:** 1 · **Valor de negocio:** 100 · `IA-01` `Ingeniería`

**Horas (mín / probable / máx):** ingenieria 8 / 12 / 16

Criterios de aceptación:
- 100 % de respuestas con fuente, corte, definición y responsable

#### ⬜ PBI-10 · Construir la interfaz simple de preguntas

Como analista de Mercadeo de Brío, quiero construir la interfaz simple de preguntas, para que el analista pregunte en lenguaje normal.

**Estado:** New · **Esfuerzo:** 8 · **Prioridad:** 1 · **Valor de negocio:** 100 · `IA-01` `Ingeniería`

**Horas (mín / probable / máx):** ingenieria 10 / 16 / 24

Criterios de aceptación:
- 4 analistas la usan sin ayuda tras 30 minutos de inducción

#### ⬜ PBI-11 · Implementar permisos y registro de preguntas y respuestas

Como analista de Mercadeo de Brío, quiero implementar permisos y registro de preguntas y respuestas, para controlar quién ve qué y auditar.

**Estado:** New · **Esfuerzo:** 8 · **Prioridad:** 1 · **Valor de negocio:** 100 · `IA-01` `Ingeniería`

**Horas (mín / probable / máx):** ingenieria 8 / 10 / 14

Criterios de aceptación:
- Solo usuarios del piloto acceden; 100 % de interacciones registradas

#### ⬜ PBI-12 · Evaluar contra la batería de preguntas y corregir

Como analista de Mercadeo de Brío, quiero evaluar contra la batería de preguntas y corregir, para llegar al piloto sin cifras erradas.

**Estado:** New · **Esfuerzo:** 8 · **Prioridad:** 1 · **Valor de negocio:** 100 · `IA-01` `Ingeniería`

**Horas (mín / probable / máx):** ingenieria 12 / 18 / 26 · expertos 2 / 3 / 4

Criterios de aceptación:
- 100 % de cifras coinciden con el cálculo manual

#### ⬜ PBI-13 · Acompañar el piloto de 4 semanas y ajustar

Como analista de Mercadeo de Brío, quiero acompañar el piloto de 4 semanas y ajustar, para corregir rápido lo que falle.

**Estado:** New · **Esfuerzo:** 13 · **Prioridad:** 1 · **Valor de negocio:** 100 · `IA-01` `Ingeniería`

**Horas (mín / probable / máx):** ingenieria 14 / 20 / 28 · expertos 4 / 6 / 8

Criterios de aceptación:
- Retro semanal con analistas y ajustes cerrados

#### ⬜ PBI-14 · Montar la medición piloto vs control

Como analista de Mercadeo de Brío, quiero montar la medición piloto vs control, para saber si el copiloto mejora algo.

**Estado:** New · **Esfuerzo:** 5 · **Prioridad:** 1 · **Valor de negocio:** 100 · `IA-01` `Ingeniería`

**Horas (mín / probable / máx):** ingenieria 6 / 8 / 10

Criterios de aceptación:
- Tablero con horas, reproceso, exactitud y uso por grupo

#### ⬜ PBI-15 · Documentar y traspasar a operación

Como analista de Mercadeo de Brío, quiero documentar y traspasar a operación, para que el área opere sin depender del proyecto.

**Estado:** New · **Esfuerzo:** 5 · **Prioridad:** 1 · **Valor de negocio:** 100 · `IA-01` `Ingeniería`

**Horas (mín / probable / máx):** ingenieria 6 / 8 / 10

Criterios de aceptación:
- Manual y dueño de operación asignado

### F1.3 · Controles de seguridad (Seguridad)

#### ⬜ PBI-16 · Revisar arquitectura, datos y proveedor del modelo

Como Responsable de Seguridad, quiero revisar arquitectura, datos y proveedor del modelo, para usar IA sin exponer información.

**Estado:** New · **Esfuerzo:** 3 · **Prioridad:** 1 · **Valor de negocio:** 100 · `IA-01` `Seguridad`

**Horas (mín / probable / máx):** seguridad 3 / 4 / 6

Criterios de aceptación:
- Concepto de Seguridad aprobado antes de construir
- Ventas sin datos personales [Por confirmar]

#### ⬜ PBI-17 · Validar permisos y registros antes del piloto

Como Responsable de Seguridad, quiero validar permisos y registros antes del piloto, para salir al piloto con controles.

**Estado:** New · **Esfuerzo:** 2 · **Prioridad:** 1 · **Valor de negocio:** 100 · `IA-01` `Seguridad`

**Horas (mín / probable / máx):** seguridad 1 / 2 / 3

Criterios de aceptación:
- Checklist de Seguridad firmado

## E2 · Experimentos en paralelo para Dirección

_New._ Validar antes de construir los pedidos del CEO: promociones (IA-02), decisiones (IA-05) y creatividad condicionada (IA-04).

### F2.1 · IA-02 · Experimento de promociones por región

#### ⬜ PBI-18 · Extraer el histórico de promociones y descuentos de Brío

Como Responsable de Datos, quiero extraer el histórico de promociones y descuentos de Brío, para tener base para diseñar el experimento.

**Estado:** New · **Esfuerzo:** 5 · **Prioridad:** 2 · **Valor de negocio:** 60 · `IA-02` `Datos`

**Horas (mín / probable / máx):** datos 4 / 6 / 9

Criterios de aceptación:
- Histórico por región con descuento y fecha
- Datos parciales

#### ⬜ PBI-19 · Analizar el histórico y diseñar el experimento por regiones

Como Ingeniero de Producto IA, quiero analizar el histórico y diseñar el experimento por regiones, para probar si las promociones recomendadas venden más.

**Estado:** New · **Esfuerzo:** 8 · **Prioridad:** 2 · **Valor de negocio:** 60 · `IA-02` `Ingeniería`

**Horas (mín / probable / máx):** ingenieria 8 / 12 / 18 · expertos 1 / 2 / 3

Criterios de aceptación:
- Diseño con regiones piloto y control aprobado por Comercial y Finanzas
- Comercial: 3-5 h

### F2.2 · IA-05 · Validación del asistente de decisiones

#### ⬜ PBI-22 · Diseñar la rúbrica con Dirección y calificar la línea base

Como Ingeniero de Producto IA, quiero diseñar la rúbrica con Dirección y calificar la línea base, para tener por primera vez una métrica de calidad de decisión.

**Estado:** New · **Esfuerzo:** 5 · **Prioridad:** 2 · **Valor de negocio:** 60 · `IA-05` `Ingeniería`

**Horas (mín / probable / máx):** ingenieria 6 / 8 / 12

Criterios de aceptación:
- Rúbrica aprobada y 5-6 documentos calificados
- Dirección: 2-4 h [Por confirmar]

#### ⬜ PBI-23 · Configurar el asistente revisor y ejecutar 3-4 sesiones

Como Ingeniero de Producto IA, quiero configurar el asistente revisor y ejecutar 3-4 sesiones, para probar si mejora la calidad del documento.

**Estado:** New · **Esfuerzo:** 8 · **Prioridad:** 2 · **Valor de negocio:** 60 · `IA-05` `Ingeniería`

**Horas (mín / probable / máx):** ingenieria 8 / 12 / 16

Criterios de aceptación:
- Calificación ciega de documentos con y sin asistente

#### ⬜ PBI-24 · Revisar seguridad de contenido sensible

Como Responsable de Seguridad, quiero revisar seguridad de contenido sensible, para proteger información de Dirección.

**Estado:** New · **Esfuerzo:** 2 · **Prioridad:** 2 · **Valor de negocio:** 60 · `IA-05` `Seguridad`

**Horas (mín / probable / máx):** seguridad 1 / 2 / 3

Criterios de aceptación:
- Concepto de Seguridad aprobado

### F2.3 · IA-04 · Prueba creativa (condicionada)

#### ⬜ PBI-20 · Revisar términos de la herramienta creativa existente

Como Responsable de Seguridad, quiero revisar términos de la herramienta creativa existente, para proteger derechos y datos de marca.

**Estado:** New · **Esfuerzo:** 2 · **Prioridad:** 2 · **Valor de negocio:** 60 · `IA-04` `Seguridad` `Condicionado`

**Horas (mín / probable / máx):** seguridad 1 / 2 / 3

Criterios de aceptación:
- Concepto de Seguridad sobre la herramienta
- Condicionado (S-13)

#### ⬜ PBI-21 · Preparar guía y ejecutar la prueba creativa con 2-3 briefs

Como Ingeniero de Producto IA, quiero preparar guía y ejecutar la prueba creativa con 2-3 briefs, para saber si acelera piezas aprobadas.

**Estado:** New · **Esfuerzo:** 5 · **Prioridad:** 2 · **Valor de negocio:** 60 · `IA-04` `Ingeniería` `Condicionado`

**Horas (mín / probable / máx):** ingenieria 6 / 8 / 12 · expertos 4 / 6 / 8

Criterios de aceptación:
- Piezas aprobadas y rondas de ajuste medidas
- Condicionado (S-13)

# Qué calibra el motor y cuánto pesa cada factor

Fecha: 11/11/2026. Todo se midió con el motor real compilado (`web/engine.js`), sin tocar `web/`, `src/` ni `server/`.
Scripts nuevos: `scripts/engine-weights-check.mjs` (resultados en `research/history/engine-weights.json`) y `scripts/season-monte-carlo.mjs` (resultados en `research/history/season-monte-carlo.json`).

## 1. ¿Con qué partidos se calibró el motor?

**Respuesta: solo con partidos del torneo mayor (Top 12/13/14 de la URBA). No hay ningún resultado de Intermedia, Pre A, reserva ni juveniles.**

| Prueba | Qué muestra |
| --- | --- |
| `research/history/urba-results.json` | Es la única base de resultados: 1.347 partidos 2016–2026 (1.285 regulares, 30 de segunda fase 2021, 20 semifinales, 10 finales, 2 cuartos). Su descripción dice «máximo torneo de la URBA». |
| `scripts/fetch-urba-history.mjs` (línea ~291) | Al leer A Pleno Rugby ignora expresamente las secciones «Repechaje», «Reubicación», «Primera A» y «Promoción». Las demás fuentes son Wikipedia (Top 12/13/14) y ESPN/Datafactory (URBA Top 14 2026). |
| `scripts/engine-calibration-check.mjs`, `history-sim-compare.mjs`, `history-analysis.mjs` | Leen solo `urba-results.json`, `analysis.json` y los partidos `competitionId === 'top14'` de `catalog.json`. |
| `research/history/calibration-history-report.md` | Describe solo el torneo mayor; no menciona reservas. |
| `research/history/urba-lineups-primera-a.json` / `-b.json` | Son formaciones (quién jugó), usadas para trayectoria y valoración de jugadores. No tienen resultados que calibren el motor. |

Lo que sí hay fuera del Top 14:

- **Primera A y B:** no hay resultados publicados. Se calibraron solo con 15 casos de clubes ascendidos en su primera temporada en el torneo mayor (`scripts/promotion-check.mjs`, `DIVISION_BASELINE`). Siguen siendo partidos de Primera, jugados con el mismo motor.
- **Intermedia, Pre A, Pre B, M19, M17:** no usan el motor. `parallelScore` (`web/domain.js`) usa una fórmula de Poisson con constantes elegidas a mano (0,28 tries por punto de nivel, ~48 puntos por partido). **No hay calibración histórica de estas categorías.**

## 2. Cuánto pesa cada factor en un partido

### Método

1. **Efectos aislados.** Un club (Newman) contra su clon exacto, 2.000–4.000 partidos con semillas distintas. Se cambia un solo factor y se mide el cambio de margen (puntos del local menos puntos del visitante) y de probabilidad de ganar (empate = media victoria). El error estándar del margen es ~0,3–0,4 puntos.
2. **Interruptores.** `HOME_EDGE` y `DAY_FORM` son constantes: se corrió una copia de `web/engine.js` con la constante en 0 (el script la escribe en la carpeta temporal del sistema).
3. **Reparto de varianza.** Dos temporadas ida y vuelta del Top 14 (182 partidos) repetidas con 30 semillas = 5.460 partidos. Se ajusta `margen = local + rating(local) − rating(visitante) + ruido` por mínimos cuadrados. El ruido es lo que queda: azar puro del partido.

### Efecto de cada factor (un solo club contra un rival parejo)

| Factor | Cambio | Margen | Prob. de ganar |
| --- | --- | ---: | ---: |
| **Nivel del plantel** | +1 punto en todos los atributos (≈ +5 de valoración del XV) | **+17,7** | 58,9 → 88,8 % (con localía) |
| | −1 punto en todos los atributos | −18,1 | 58,9 → 18,0 % |
| | 1 punto de valoración del XV | ≈ **+3,4** | ≈ +6 puntos % |
| **Localía** (`HOME_EDGE` 0,62) | local contra visitante, club idéntico | **+2,8** | 50,7 → 58,9 % (+8) |
| **Forma del día** (`DAY_FORM` 0,02) | ±2 % de los atributos, triangular (σ ≈ 0,8 % por equipo) | σ ≈ ±1,8 por equipo, ±2,5 en el margen (estimado) | no detectable en la medición (< 0,4 de σ) |
| **Físico** | XV al 92 % contra rival al 100 % | −4,9 | −12 puntos % |
| | al 85 % / 70 % | −10,5 / −19,7 | −25 / −44 puntos % |
| | ambos equipos al 92 % | −1,0 | −3,7 puntos % |
| **Lesiones** | un titular menos (reemplazo: el mejor de su puesto) | −2,0 (peor caso −6,2) | no medida |
| | 3 titulares / 5 titulares | −5,6 / −8,7 | |
| **Tácticas** (una opción contra defecto) | mejor: Rush +2,0; Competir en lineout +1,2; Evitar maul −1,0; Presión en scrum +0,9; Touch +0,9; Palos −0,8 | entre −1,0 y +2,0 | entre −3 y +4 puntos % |
| | si dos managers eligen opciones al azar | σ ≈ 2,4 en el margen | |

Notas:

- **Nivel del club e historia.** El motor no tiene memoria del club: la fuerza del catálogo y `DIVISION_BASELINE` solo actúan al crear la liga, porque fijan los atributos de los jugadores (`levelClubSquad` quita el sesgo del azar de la generación). Un punto de fuerza del catálogo ≈ 0,07 puntos de atributo ≈ 0,35 de valoración ≈ 1,2 de margen. Después de eso solo cuentan los jugadores.
- **Distancias medidas** (club mediano contra club mediano, promediando las dos localías):

| Cruce | Diferencia de valoración del XV | Margen | Gana el mejor |
| --- | ---: | ---: | ---: |
| Newman – Champagnat (mejor y peor del Top 14) | 10,0 | +28,0 | 95 % |
| Newman – Regatas | 2,9 | +10,6 | 74 % |
| Top 14 mediano – Primera A mediano | 9,1 | +25,1 | 94 % |
| Primera A mediano – Primera B mediano | 6,8 | +17,9 | 88 % |

- **Tácticas.** Rush (+2,0) supera el tope de ±1,2 que declara el resumen del proyecto. Es un dato a revisar: el comentario de `TACTIC_TUNING` ya dice que Rush vale ≈ +2,4 para Newman.
- **Forma del día.** La medición no distingue su efecto del ruido. La cuenta analítica da ~2 % de la varianza: 1 % de habilidad ≈ 2,2 puntos de margen (se deduce del físico) y la forma mueve ~0,8 % por equipo.

### Reparto de la varianza del margen (Top 14, 5.460 partidos)

σ del margen = 21,1 (incluye la localía y las diferencias de club). σ del ruido puro = 16,5.

| Componente | % de la varianza del margen | % de la media cuadrática (incluye localía) |
| --- | ---: | ---: |
| Calidad de los equipos (plantel y club) | **38,5** | 38,0 |
| Azar del partido | **61,5** | 60,8 |
| — de ese azar, forma del día | < 1 (medido) | 0,4 |
| Localía (diferencia media de +2,3) | no es varianza | **1,2** |
| Tácticas, si ambos managers eligen al azar | | +1,2 (adicional) |

- La calidad de los equipos es casi toda nivel de plantel: la valoración media del XV explica el 89 % de las diferencias de rating entre clubes (r = 0,95; 2,9 puntos de margen por punto de valoración).
- **Conclusión.** Un partido es sobre todo azar (~60 %); el resto es el nivel del plantel (~38 %). La localía y las tácticas pesan poco: la localía mueve 2,8 puntos y una táctica a elección, entre ~1 y ~2. El físico es el único «pequeño» que puede crecer: un XV al 85 % contra otro al 100 % pierde ~10 puntos.
- Ese azar (σ 16,5) es mayor que el real, algo que ya figuraba como pendiente en la calibración.

## 3. Simulación de temporadas (Monte Carlo)

**Se simularon 297 temporadas, no 1.000.** El script corrió bajo carga (otro proceso en la misma máquina) y alcanzó el límite de 25 minutos. Cada muestra crea una liga nueva con una semilla distinta (1000, 1001…) y juega las 26 fechas con `advanceWorld`; no hay temporadas encadenadas. Sola, la máquina hace una temporada en ~1 s, así que 1.000 tardan ~15 minutos: `node scripts/season-monte-carlo.mjs --seasons 1000 --minutes 40`.

Hay tablas reales 2026 de las tres divisiones en `catalog.json` (`historical2026`), incluidas Primera A y B.

| División | Spearman (posición simulada media contra real) | Error medio de puntos (RMSE) |
| --- | ---: | ---: |
| Top 14 | 0,90 | 11,2 |
| Primera A | 0,94 | 7,7 |
| Primera B | 0,96 | 4,6 |

### Top 14 (297 temporadas)

| Club | Pos. media | Pos. real | Puntos sim. | Puntos reales | 1.º | Top 4 | Últimos 2 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Newman | 2,1 | 1 | 89,4 | 110 | 50,5 % | 89,2 % | 0 % |
| Belgrano Athletic | 3,5 | 7 | 82,0 | 58 | 15,8 % | 70,7 % | 0 % |
| Alumni | 3,9 | 4 | 79,3 | 86 | 10,1 % | 63,0 % | 0 % |
| CASI | 4,2 | 2 | 78,1 | 90 | 9,1 % | 54,5 % | 0 % |
| SIC | 4,3 | 5 | 77,7 | 86 | 8,1 % | 54,9 % | 0 % |
| Hindú | 4,7 | 3 | 75,5 | 89 | 5,7 % | 46,5 % | 0 % |
| Los Tilos | 7,2 | 6 | 63,7 | 69 | 0,3 % | 10,4 % | 0 % |
| Regatas Bella Vista | 7,8 | 8 | 61,3 | 56 | 0,3 % | 7,7 % | 0,3 % |
| CUBA | 8,3 | 9 | 58,2 | 51 | 0 % | 2,7 % | 0 % |
| La Plata | 10,3 | 11 | 46,8 | 42 | 0 % | 0,3 % | 5,4 % |
| Buenos Aires C&RC | 10,8 | 12 | 43,4 | 40 | 0 % | 0 % | 6,7 % |
| Atlético del Rosario | 11,4 | 10 | 39,4 | 43 | 0 % | 0 % | 21,2 % |
| Los Matreros | 13,1 | 13 | 27,0 | 36 | 0 % | 0 % | 76,8 % |
| Champagnat | 13,5 | 14 | 23,2 | 15 | 0 % | 0 % | 89,6 % |

### Primera A

| Club | Pos. media | Pos. real | Puntos sim. | Puntos reales | 1.º | Top 4 | Últimos 2 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| San Luis | 1,3 | 1 | 103,3 | 105 | 78,8 % | 100 % | 0 % |
| Curupaytí | 2,7 | 4 | 90,0 | 85 | 9,4 % | 92,3 % | 0 % |
| San Cirano | 3,2 | 2 | 85,9 | 88 | 8,4 % | 85,9 % | 0 % |
| Lomas Athletic | 3,6 | 3 | 82,9 | 85 | 3,0 % | 82,2 % | 0 % |
| San Fernando | 6,8 | 5 | 63,9 | 74 | 0 % | 10,8 % | 0,3 % |
| Hurling | 7,1 | 8 | 62,4 | 60 | 0,3 % | 11,4 % | 0 % |
| GEBA | 7,5 | 7 | 60,2 | 61 | 0 % | 5,4 % | 0 % |
| Pucará | 7,7 | 6 | 59,0 | 67 | 0 % | 4,0 % | 0 % |
| Deportiva Francesa | 7,8 | 12 | 58,9 | 40 | 0 % | 4,4 % | 0 % |
| San Andrés | 7,9 | 9 | 58,0 | 55 | 0 % | 3,7 % | 0,7 % |
| Pueyrredón | 11,1 | 10 | 40,0 | 48 | 0 % | 0 % | 8,1 % |
| Olivos | 11,6 | 11 | 36,7 | 41 | 0 % | 0 % | 17,2 % |
| San Albano | 13,2 | 13 | 23,7 | 36 | 0 % | 0 % | 85,5 % |
| Universitario La Plata | 13,4 | 14 | 21,0 | 25 | 0 % | 0 % | 88,2 % |

### Primera B

| Club | Pos. media | Pos. real | Puntos sim. | Puntos reales | 1.º | Top 4 | Últimos 2 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Banco Nación | 1,2 | 1 | 99,2 | 93 | 84,5 % | 99,3 % | 0 % |
| Liceo Naval | 3,5 | 3 | 81,8 | 82 | 7,7 % | 75,8 % | 0 % |
| Don Bosco | 4,4 | 4 | 77,5 | 77 | 1,3 % | 55,2 % | 0 % |
| CU Quilmes | 4,5 | 2 | 77,1 | 84 | 2,4 % | 52,9 % | 0 % |
| Manuel Belgrano | 4,9 | 5 | 75,6 | 75 | 1,3 % | 44,1 % | 0 % |
| Mariano Moreno | 5,3 | 6 | 72,9 | 72 | 2,0 % | 36,7 % | 0 % |
| Italiano | 5,9 | 9 | 70,3 | 63 | 0,7 % | 26,6 % | 0 % |
| San Patricio | 8,0 | 8 | 59,7 | 64 | 0 % | 5,4 % | 0 % |
| San Martín | 8,2 | 7 | 58,8 | 65 | 0 % | 3,7 % | 0 % |
| Delta | 10,3 | 11 | 47,3 | 48 | 0 % | 0,3 % | 7,1 % |
| Monte Grande | 11,1 | 12 | 41,0 | 43 | 0 % | 0 % | 13,5 % |
| Argentino | 11,1 | 10 | 40,4 | 49 | 0 % | 0 % | 14,5 % |
| Liceo Militar | 12,6 | 13 | 29,0 | 28 | 0 % | 0 % | 65,7 % |
| Vicentinos | 13,9 | 14 | 15,2 | 11 | 0 % | 0 % | 99,0 % |

### Clubes lejos de lo real (más de 2 puestos o 12 puntos)

| División | Club | Simulado | Real | Lectura |
| --- | --- | --- | --- | --- |
| Top 14 | Belgrano Athletic | puesto 3,5 y 82 pts | 7.º y 58 | Sobrevalorado (fuerza 78 del catálogo, en el grupo de arriba). |
| Top 14 | Newman | 89 pts | 110 pts | Gana menos que en la realidad: el motor tiene más azar y comprime las puntas. |
| Top 14 | Hindú y CASI | 76 y 78 pts | 89 y 90 | Subvalorados (en la realidad se despegaron del medio). |
| Primera A | Deportiva Francesa | puesto 7,8 y 59 pts | 12.º y 40 | Sobrevalorada. |
| Primera A | San Fernando | 64 pts | 74 | Subvalorado. |
| Primera A | San Albano | 24 pts | 36 | Peor que lo real (el descenso real fue menos claro). |
| Primera B | Italiano | puesto 5,9 y 70 pts | 9.º y 63 | Algo alto. |
| Primera B | CU Quilmes | puesto 4,5 | 2.º y 84 pts | Algo bajo. |

El patrón general es el mismo en las tres divisiones: los extremos de la tabla real son más extremos que los del motor, y el orden central se confunde más. Con 297 temporadas, el error de cada probabilidad de campeón es de hasta ~3 puntos porcentuales.

## Para repetir

```sh
npm run build
node scripts/engine-weights-check.mjs --n 2000 --seasons 30   # factores y varianza (unos 15 minutos)
node scripts/season-monte-carlo.mjs --seasons 1000 --minutes 40
```

## 4. Corrida completa: 1.000 temporadas (12/11/2026)

Diez procesos en paralelo de 100 temporadas cada uno (semillas 5000–5999), unidos con `scripts/season-monte-carlo-merge.mjs`. Cada muestra es la temporada 2026 desde cero; la tabla es la de la fase regular (los playoffs no suman). Resultado en `research/history/season-monte-carlo.json`.

| División | Spearman con la tabla real 2026 | Error medio de puntos (RMSE) |
| --- | ---: | ---: |
| Top 14 | 0,886 | 11,4 |
| Primera A | 0,943 | 7,9 |
| Primera B | 0,965 | 4,5 |

- Top 14: Newman termina 1º en el 43 % de las temporadas y entre los cuatro en el 90 %, pero promedia 89 puntos contra 110 reales. Belgrano Athletic promedia 3,4º y 82 puntos, contra 7º y 58 reales. CASI, Hindú, SIC y Alumni quedan unos 8–14 puntos por debajo de lo real; Champagnat (91 % entre los dos últimos) y Los Matreros (78 %) son los descendidos esperados.
- Primera A: San Luis 1º en el 78 %. Deportiva Francesa promedia 7,9º contra 12º real; San Fernando 7,1º con 63 puntos contra 5º y 74.
- Primera B: Banco Nación 1º en el 81 %; Vicentinos último casi siempre.
- Patrón: el orden se parece mucho al real, pero la tabla simulada está más apretada (los de arriba suman menos puntos y los de abajo más), coherente con el 61,5 % de azar por partido de la sección 2.

## 5. Ajuste del 12/11/2026

- **Diagnóstico:** el promedio de 1.000 temporadas siempre es más parejo que una temporada real, porque el promedio borra la suerte. La comparación justa es la dispersión dentro de una sola temporada (`scripts/season-spread-check.mjs`), y daba parecida a la real. El problema estaba en clubes puntuales: Newman, CASI y Hindú bajos; Belgrano y Deportiva Francesa altos.
- **Ajuste de fuerzas:** `scripts/fit-club-strength.mjs` ajustó la fuerza del catálogo de 36 clubes. El objetivo es la tabla 2026 descontada la suerte de una temporada: objetivo = media + 0,85 × (real − media). Hizo dos iteraciones de 40 temporadas; el error pasó de 7,7 a 2,6 puntos. Antes y después en `research/history/strength-fit.json` y `strength-v15.json`.
- **Rush:** bajó (`rushPressureGain` 0,9, `rushPressureError` 0,014) de +3,3 a +0,8 de margen.
- **Cruces:** Newman–CASI 70 % y +10,3; Newman–Regatas 87 %; Newman–Hindú 76 %; CASI–Regatas 74 %; SIC–CASI 55 %; local 53,1 % y +2,85. Todos dentro de los rangos reales salvo el margen de Newman–CASI (real +5/+6).
- **1.000 temporadas después del ajuste:**

| División | Spearman antes → después | Error de puntos antes → después |
| --- | --- | --- |
| Top 14 | 0,886 → 0,938 | 11,4 → 5,8 |
| Primera A | 0,943 → 0,982 | 7,9 → 4,6 |
| Primera B | 0,965 → 0,978 | 4,5 → 4,3 |

- **Dispersión de una temporada** (desvío de puntos, simulado contra real): Top 14 23,6 contra 25,8; Primera A 21,2 contra 22,3; Primera B 20,4 contra 22,1.
- **Newman:** sale 1º de la fase regular en el 81 % de las temporadas.

# Calibración del motor con resultados históricos del URBA (2016–2026)

**Fecha de corte:** 10/11/2026. **Estado:** propuesta. No se modificó `src/engine`, `web/` ni `research/catalog.json`. La decisión de aplicarla queda para el usuario.

## Resumen

- Se reunieron **1.347 partidos** del máximo torneo URBA en **10 temporadas**: 2016–2019 y 2021–2026. 2020 no se jugó. Hay **1.315 partidos de fase regular** en cancha de uno de los dos equipos y **32 de playoffs**. Para 198 partidos (2024 y 2026) también hay tries, conversiones, penales y drops.
- **Localía real.** El local gana el **53,1 %** de los partidos regulares (IC 95 %: 50,4–55,8 %), empata el 2,7 % y pierde el 44,3 %. Una vez descontada la fuerza de cada club, la ventaja es de **+2,0 a +2,8 puntos**. En el motor actual es de **+0,5 a +0,8 puntos** (local 49,7–52 %). El motor subestima la localía en un factor de alrededor de 3.
- **Dispersión real.** El 41,9 % de los partidos se define por 7 puntos o menos y solo el 6,5 % por 35 o más. En el motor esos valores son **24,8 %** y **15 %**: hay demasiadas goleadas y pocos partidos cerrados. El motor también exagera las diferencias de fuerza entre clubes. El desvío de los ratings simulados es de 11,8 puntos, contra 8,1 reales. El ruido de cada partido también es mayor: 16–17 puntos contra 14,3 reales.
- **Newman–CASI con Newman local.** Según el modelo, la probabilidad está entre el **62 y el 80 %**, con un valor central cercano al **68–70 %**. La diferencia esperada es de +5 a +6 puntos. El motor da **78 %** con un margen medio de **+15,4**. La probabilidad está en el borde alto del rango plausible, pero el margen está muy inflado. La sospecha del usuario se confirma más en el tanteo que en el porcentaje. En los hechos, Newman le ganó 15 de 18 partidos a CASI desde 2016 y los 9 que jugó de local.
- **Propuesta:** subir la localía (`edge` de 0,16 a **0,56**), bajar la forma del día de ±5,5 % a **±2 %** y recalibrar la fuerza de cada club del catálogo (por ejemplo, Newman de 93 a **83**). Además, conviene acotar las tácticas: Rush y el pie conservador mueven ±10–14 puntos porcentuales, más que toda la distancia real entre Newman y CASI. Con el prototipo, Newman–CASI queda en **59,9 %** (+5,3) y Newman–Regatas en **82,3 %**, contra 81,7 % empírico. El error de los ratings de club baja de 4,6 a **1,2 puntos**.

## 1. Fuentes y cobertura

Datos: `research/history/urba-results.json`, con fuente por partido y fecha de consulta del 10/11/2026. Para regenerarlos se usa `node scripts/fetch-urba-history.mjs`. El script guarda las respuestas en un caché fuera del repositorio y no usa credenciales. Hace los pedidos en serie, con pausas de 0,4 a 2,5 s, y reintenta ante el error 429.

| Fuente | Uso |
| --- | --- |
| ESPN, API pública del sitio, liga `289279` «URBA Top 14» (datos Opta) | Primaria 2019–2026, scoreboard por temporada. Control de 2017–2018. Tries de 52 partidos de 2024. |
| A Pleno Rugby, archivo de resultados (`/site/resultados-614`, `resultados-2017-628`, `resultados-2017-2a-rueda-637`, `resultados-urba-2018-647`) | Primaria 2016–2018: fuente original que cita Wikipedia. Indica la sede neutral (CASI) de los playoffs. |
| Wikipedia en español, páginas «Top 12/13/14 de la URBA AAAA» (revisión fijada por `oldid`) | Control partido por partido 2016–2018. Tablas finales de 2016–2025 y playoffs de 2019–2025. |
| ESPN/Datafactory (`espn.datafactory.la/.../urba/events/{id}.json`) | 2026: control de tanteos, fecha, ronda, tries, conversiones, penales, drops, tries penales y tarjetas de 147 partidos. |
| `research/catalog.json` (`historical2026`, fixture oficial) | Control de la tabla 2026 y rondas. |

| Temporada | Formato | Clubes | Regulares (esperados) | Playoffs | Primaria | Control de tabla |
| --- | --- | ---: | --- | ---: | --- | --- |
| 2016 | Top 14, una rueda + cuartos | 14 | 91 (91) | 5 | A Pleno | Wikipedia: 2 diferencias de 1 punto |
| 2017 | Top 12 | 12 | 131 (132) | 3 | A Pleno (+ESPN) | Wikipedia: diferencias de 2–10 puntos en 4 clubes |
| 2018 | Top 12 | 12 | 132 (132) | 3 | A Pleno | Tabla de Wikipedia incompleta (20 fechas) |
| 2019 | Top 12 | 12 | 132 (132) | 3 | ESPN | Tabla de Wikipedia desactualizada y no comparable |
| 2021 | Top 12, una rueda + 2.ª fase por zonas (COVID) | 12 | 96 (96) | 3 | ESPN | Sin comparación: la tabla publicada es parcial |
| 2022 | Top 13 | 13 | 156 (156) | 3 | ESPN | Coincide salvo un dato de Wikipedia (San Luis, PC 638/683) |
| 2023 | Top 12 | 12 | 132 (132) | 3 | ESPN | **Coincide exactamente** |
| 2024 | Top 12 | 12 | 131 (132) | 3 | ESPN | Faltan SIC–BACRC y una errata de Wikipedia en Alumni |
| 2025 | Top 12 | 12 | 132 (132) | 3 | ESPN | **Coincide exactamente** |
| 2026 | Top 14 | 14 | 182 (182) | 3 | ESPN + Datafactory | **Coincide exactamente** con `historical2026` |

**Clubes.** Todos los nombres se normalizaron a los IDs del catálogo. Pucará, San Luis, San Martín, Lomas Athletic y Mariano Moreno jugaron el torneo mayor en algunas temporadas, pero hoy están en Primera A o B; siguen en el catálogo con su ID.

**Huecos documentados** (ver `gaps` en el JSON):
- 2017: CASI–Atlético del Rosario no se jugó; ambos terminaron con 21 partidos en la tabla oficial.
- 2024: ESPN marca SIC–Buenos Aires C&RC del 20/4 como finalizado 0-0, un marcador sin cargar. Otra fuente no confirmó el tanteo y el partido se excluyó. La tabla sugiere un 31-25, pero no se infirió.
- 2020: el torneo se canceló; ESPN lista 131 partidos postergados.
- 2016–2023 no tienen tries por partido en las fuentes consultadas.

**Conflictos entre fuentes** (7, ver `conflicts`):

| Partido | Valores | Usado |
| --- | --- | --- |
| 2017 CUBA–Belgrano | A Pleno 37-22, ESPN 37-20 | A Pleno |
| 2017 Regatas–CUBA | A Pleno y Wikipedia 10-23; ESPN 10-6, un parcial | A Pleno |
| 2017 Pucará–Hindú | A Pleno 12-17; ESPN y Wikipedia 12-19 | Mayoría: la tabla oficial cuadra con 12-19 |
| 2018 Alumni–Newman | A Pleno y ESPN 34-23, Wikipedia 35-23 | A Pleno |
| 2018 Hindú–San Martín | A Pleno 57-29, Wikipedia 59-27 | A Pleno |
| 2018 semifinal San Luis–Alumni | A Pleno 3-50, plantilla de Wikipedia invertida | A Pleno |
| 2021 semifinal Newman–CUBA | ESPN 15-18, Wikipedia 15-16 | ESPN; no se halló tercera fuente y el ganador es el mismo |

**Playoffs.** Desde 2017 siempre son semifinales y final. En 2016 hubo además cuartos de final. De 2016 a 2018, A Pleno indica que se jugaron en cancha neutral (CASI). Para años posteriores la sede no está verificada (`neutral: null`). Los playoffs se excluyen del cálculo de localía.

## 2. Métodos

`node scripts/history-analysis.mjs` genera `research/history/analysis.json`. El cálculo es determinista.

- **Localía.** Se midieron tres cosas: (a) los porcentajes de victoria, empate y derrota del local; (b) el margen medio local; (c) el parámetro H de un modelo de margen por temporada, que controla la fuerza de cada club; y (d) el promedio, en cada par que jugó ida y vuelta, de los dos márgenes como local, que equivale a 2H.
- **Modelo de margen.** Supone que `margen_local = r_local − r_visitante + H + ε`, con ε ~ N(0, σ). Se ajusta por mínimos cuadrados con penalización ridge (λ = 2) y la condición Σr = 0. De él salen ratings en puntos de margen frente a un rival medio, H, σ (el ruido de cada partido) y la probabilidad Φ((Δ + H)/σ).
- **Modelo logístico.** Es un Bradley–Terry con localía y penalización L2, ajustado sobre resultados: victoria, empate o derrota.
- **Elo secuencial.** Usa un multiplicador por margen y regresión entre temporadas. Los parámetros se eligieron con una grilla que minimiza el log-loss fuera de muestra: K = 24, localía de 40 puntos Elo y arrastre de 0,8. El resultado es un log-loss de 0,578 contra 0,69 de la línea base y un Brier de 0,19.
- **Ratings vigentes al 10/11/2026.** Hay dos versiones: (a) 2026 solo y (b) 2024–2026 con pesos 0,25, 0,5 y 1, que se usa como objetivo de calibración porque es menos ruidosa.
- **Sorpresas.** Se midieron como la victoria del peor ubicado en la tabla final y como la victoria del no favorito según el Elo previo al partido.
- **Pares de clubes.** Se compararon el historial directo, el récord como local, los rivales comunes en 2026 (la diferencia de margen contra el mismo rival con la misma localía) y la probabilidad según cada modelo.

## 3. Resultados empíricos (fase regular, cancha no neutral)

| Indicador | 2016–2026 (n = 1.315) | 2022–2026 (n = 733) | 2026 (n = 182) |
| --- | ---: | ---: | ---: |
| Victoria / empate / derrota del local | 53,1 / 2,7 / 44,3 % | 55,5 / 2,3 / 42,2 % | 50,5 / 1,1 / 48,4 % |
| Margen local medio | +2,18 | +2,81 | +2,11 |
| Desvío del margen | 17,9 | 17,6 | 20,4 |
| Margen p10 / p50 / p90 | −21 / +1 / +25 | −20 / +2 / +25 | −23 / +1 / +30 |
| Partidos por ≤ 7 / ≥ 21 / ≥ 35 puntos | 41,9 / 24,6 / 6,5 % | 42,4 / 24,1 / 6,8 % | 36,3 / 29,7 / 8,8 % |
| Puntos totales por partido | 52,6 (desvío 15,6) | 54,3 | 59,9 |
| Tries por partido | 7,21 (n = 198, 2024 y 2026) | — | 7,59 |

**Localía «pura».** El método de pares ida y vuelta, con 563 pares, da **H = 2,04 ± 0,44** puntos. Por temporada, H varía entre −0,95 (2018) y +3,75 (2025); la media es de 2,1. El modelo 2024–2026 da H = 2,68. **Objetivo adoptado: H ≈ 2,4** (rango 2,0–2,8).

**Ruido y fuerzas.** El ruido de cada partido (σ) está entre 12,5 y 15,5 puntos según la temporada, con 14,3 en el modelo 2024–2026. Es una cota superior, porque también incluye cambios de forma a lo largo del año. El desvío de los ratings de club va de 5,2 a 9,6 puntos por temporada, con 8,1 en 2024–2026.

**Sorpresas.** El peor ubicado en la tabla final gana el **23,2 %** de los partidos decididos: 30,2 % si la distancia en la tabla es menor a 6 puestos y 9,5 % si es de 6 o más. El no favorito según el Elo previo gana el **29,3 %**. El Elo está bien calibrado: en la franja de 80–90 % predijo 84,6 % y se observó 82,3 %. Según el modelo de margen de la misma temporada, el favorito pierde el 24,7 %.

**Ratings al 10/11/2026.** La tabla muestra puntos de margen frente a un rival medio en cancha neutral.

| Club | 2026 | 2024–26 (objetivo) | Elo |
| --- | ---: | ---: | ---: |
| Newman | +12,5 | +11,1 | 1912 |
| Alumni | +11,3 | +8,3 | 1689 |
| Hindú | +9,0 | +6,7 | 1703 |
| SIC | +9,0 | +8,6 | 1699 |
| CASI | +8,3 | +9,0 | 1715 |
| CUBA | +0,5 | +1,3 | 1441 |
| Belgrano Athletic | −0,1 | +3,7 | 1508 |
| Los Tilos | −0,3 | +1,2 | 1600 |
| Regatas Bella Vista | −0,3 | +0,3 | 1403 |
| La Plata | −6,5 | −6,2 | 1381 |
| Atlético del Rosario | −6,9 | −7,5 | 1348 |
| Buenos Aires C&RC | −7,2 | −5,8 | 1389 |
| Los Matreros | −12,7 | −12,1 | 1317 |
| Champagnat | −16,7 | −15,0 | 1134 |

**Pares de clubes.** La primera columna es el club local. «Rivales comunes» es la diferencia de margen en 2026 contra el mismo rival y con la misma localía. Los porcentajes son la probabilidad de victoria del local.

| Par | Historial 2016–26 | Local A | Rivales comunes | Margen 2026 | Margen 24–26 | Logístico 2026 | Elo |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| Newman – CASI | 15-0-3 | 9 de 9 | +3,7 (12 de 24 a favor) | 64,7 % (+6,3) | 61,7 % (+4,8) | 72,0 % | 79,6 % |
| Newman – Regatas | 12-1-5 | 5 de 9 | +12,8 | 82,3 % | 81,7 % | 91,0 % | 95,9 % |
| Newman – Hindú | 13-0-8 | 7 de 10 | +2,6 | 62,8 % | 67,8 % | 75,2 % | 80,7 % |
| CASI – Regatas | 10-0-6 | 6 de 8 | +8,3 | 74,4 % | 77,6 % | 80,6 % | 88,3 % |
| SIC – CASI | 13-0-7 | 6 de 10 | +1,1 | 56,1 % | 54,9 % | 43,4 % | 53,4 % |

El modelo de margen subestima a Newman en 2026: esperaba 20,1 victorias y Newman sumó 24,5. Newman ganó 8 de los 9 partidos que se definieron por 7 puntos o menos y empató el otro. Los modelos que solo miran resultados (logístico y Elo) le asignan más. **El rango defendible para Newman local contra CASI es 62–80 %.** Ningún modelo apoya ni un 50 % ni un 90 %.

## 4. Comparación con el simulador

`node scripts/history-sim-compare.mjs --seeds 30 --pair-seeds 1000` genera `research/history/sim-compare.json`. El script construye el mundo con la semilla 2026, igual que la web, y simula los 182 partidos del Top 14 2026 con 30 semillas cada uno (5.460 partidos) y tácticas predeterminadas. Los pares se simulan con 1.000 semillas.

Para prototipar, el script copia `web/engine.js` en un directorio temporal y reemplaza tres constantes por parámetros:

- `edge` (0,16);
- la amplitud de la forma del día (0,055);
- la pendiente de `localClubStrength` (0,071).

Cada reemplazo debe aparecer una sola vez; si no, el script se detiene. Con los parámetros originales, la copia reproduce exactamente los 520/38/442 de Newman contra su clon de `calibration-report.md`.

| Indicador | Empírico | Motor actual | Prototipo |
| --- | ---: | ---: | ---: |
| Victoria / empate del local (temporada) | 53,1 / 2,7 % | 49,7 / 1,9 % | 52,0 / 2,8 % |
| Ventaja local H (modelo) | 2,0–2,8 | 0,48 | 1,97 |
| Newman contra su clon (local) | — | 52,0 %, +0,8 | 55,1 %, +2,5 |
| Desvío del margen | 17,9 | 24,1 | 21,0 |
| Ruido por partido σ | 14,3 (2024–26), 15,5 (2026) | 17,3 | 16,1 |
| Desvío de los ratings de club | 8,1 | 11,8 | 9,5 (≈ 8,1 × 1,13, ver §5) |
| Error de los ratings frente al objetivo (RMSE) | — | 4,6 | 1,2 |
| Partidos por ≤ 7 / ≥ 35 puntos | 41,9 / 6,5 % | 24,8 / 15,0 % | 29,2 / 10,7 % |
| Margen p10 / p90 | −21 / +25 | −30 / +31 | −25 / +29 |
| Puntos totales por partido | 52,6 (desvío 15,6) | 45,0 (desvío 13,1) | 44,7 |
| Tries por partido | 7,2 | 6,2 | 6,1 |
| El favorito pierde (modelo de la propia muestra) | 24,7 % | 24,2 % | 25,8 % |

| Par (local primero) | Empírico (rango de modelos) | Motor actual | Prototipo |
| --- | --- | --- | --- |
| Newman – CASI | 62–80 %, margen +5 a +6 | 78,1 %, +15,4 | 59,9 %, +5,3 |
| Newman – Regatas | 82–96 %, margen +13 a +15 | 92,5 %, +26,8 | 82,3 %, +15,9 |
| Newman – Hindú | 63–81 %, margen +6 a +7 | 75,0 %, +14,2 | 64,7 %, +7,2 |
| CASI – Regatas | 74–88 %, margen +11 | 76,4 %, +13,4 | 78,6 %, +12,8 |
| Newman – Champagnat | 97–99 %, margen +29 a +31 | 98,4 %, +41,7 | 97,5 %, +32,0 |

**Brechas principales:**

1. **Localía.** El motor da alrededor de un tercio de la ventaja real.
2. **Fuerzas.** Las fuerzas iniciales están demasiado separadas y desordenadas respecto de la realidad. Newman rinde como un equipo de +23 a +24 puntos, cuando su rating real es +11. La causa no es solo `strength = 93`: con la semilla 2026, la generación de planteles le da a Newman un XV (70,1) muy superior al de CASI (66,2). Esa variación de cada club, ajena a su fuerza, suma ±4–6 puntos de margen.
3. **Ruido.** Aun con forma 0, el ruido del motor es de 15,9 puntos, contra un real de alrededor de 14,3. Con la forma de ±5,5 % sube a 17,3. Hay demasiados resultados abultados y pocos partidos cerrados.
4. **Tanteo.** El motor anota alrededor de 8 puntos y 1 try menos por partido que la realidad.
5. **Probabilidades.** Las probabilidades de victoria de los pares resultan razonables solo porque un error compensa al otro: las fuerzas infladas, divididas por un ruido inflado. Los márgenes y la tabla de diferencias de tantos quedan muy fuera de escala.

**Tácticas.** La tabla muestra el efecto de cada cambio frente a un clon idéntico, en el motor actual y en el prototipo.

| Cambio | Δ % victoria | Δ margen |
| --- | ---: | ---: |
| Defensa Rush | +12,0 / +12,2 | +6,3 / +5,2 |
| Pie Conservador | −13,8 / −9,8 | −4,8 / −4,5 |
| Ruck Rápido | −5,4 / −8,8 | −1,8 / −3,0 |
| Maul Evitar | −4,3 / −3,5 | −1,2 / −1,4 |
| Lineout Competir, scrum Presión, ataque 2-4-2 | entre −1,4 y +2,8 | entre +0,5 y +2,0 |

Los datos históricos no permiten medir el efecto de una táctica. Sí permiten acotarlo. Toda la diferencia real entre Newman y CASI equivale a unos 2–5 puntos de margen, y el desvío entre clubes es de 8 puntos. Una sola táctica que vale +6 puntos, o que domina sin costo como Rush, pesa más que el plantel.

## 5. Propuesta de calibración (antes → después)

Hay que elegir qué se calibra. El ruido del motor (σ ≈ 16) no puede bajar a 14,3 con estos parámetros. Por eso la propuesta busca que coincidan las **probabilidades** de victoria, P = Φ((Δ + H)/σ), y no los márgenes. Los ratings objetivo se multiplican por σ_motor/σ_real = 1,13. Así, los márgenes del prototipo quedan alrededor de un 13 % más abiertos que los reales, pero los resultados, la tabla y las sorpresas quedan en escala.

1. **Localía.** El parámetro `edge` en `generateMatch` pasa de **0,16 a 0,56**. Cada 0,1 de `edge` suma unos 0,39 puntos de margen al clon. Con 0,56, H por temporada queda en 2,0 y el margen del clon en 2,5, contra un objetivo de 2,4 (rango 2,0–2,8). El local gana el 52–55 %, contra 53,1 % real. Si se prefiere la estimación de 2022–2026 (+2,8), conviene usar 0,6.
2. **Forma del día.** El factor de `prepareTeam` pasa de **±5,5 % a ±2 %**: `(rng()+rng()−1)*0.02`. La forma solo suma ruido. Con ±5,5 % el ruido sube de 15,9 a 17,3, por encima del real (≤ 14,3). Se conserva un ±2 % para que el día influya algo, con un ruido de 16,2.
3. **Fuerza por club** (`catalog.clubs[].strength`, Top 14), calibrada en 6 iteraciones con paso amortiguado y una pendiente de alrededor de 1,03 puntos de margen por punto de fuerza:

   | Club | Actual | Propuesto | Rating real 2024–26 |
   | --- | ---: | ---: | ---: |
   | Newman | 93 | **83** | +11,1 |
   | CASI | 88 | **89** | +9,0 |
   | Hindú | 87 | 87 | +6,7 |
   | SIC | 86 | 86 | +8,6 |
   | Alumni | 85 | **83** | +8,3 |
   | Los Tilos | 79 | **82** | +1,2 |
   | Belgrano Athletic | 74 | **80** | +3,7 |
   | Regatas Bella Vista | 74 | **77** | +0,3 |
   | CUBA | 72 | **70** | +1,3 |
   | Atlético del Rosario | 68 | **71** | −7,5 |
   | La Plata | 67 | **74** | −6,2 |
   | Buenos Aires C&RC | 67 | **71** | −5,8 |
   | Los Matreros | 66 | **65** | −12,1 |
   | Champagnat | 60 | **61** | −15,0 |

   Estos números **no son monótonos** respecto del rating real. Por ejemplo, Newman queda por debajo de CASI, porque compensan la variación que la semilla 2026 introduce en cada plantel. Se probó también una relación lineal sin corrección por club (fuerza = 77,1 + 0,95 × rating real). Mantiene el orden, pero falla por esa misma variación: el error es de 3,6 puntos y Newman–CASI vuelve a 80 %. Hay dos alternativas:
   - **(a)** Aplicar la tabla, aceptando que «fuerza» deja de leerse como ranking.
   - **(b)** Mejor a mediano plazo: calibrar sobre la valoración del XV generado, no sobre la fuerza del catálogo, o bien reducir la variación individual al generar el plantel para que la fuerza vuelva a reflejar el nivel del club.

   La pendiente 0,071 de `localClubStrength` no se tocó: ajustar las fuerzas es suficiente. Si se cambian los planteles o la semilla, hay que volver a correr el script.
4. **Tácticas.** Conviene acotar el efecto neto de cada opción, frente a la predeterminada y contra un rival igual, a **±1,5 puntos de margen (alrededor de ±3–4 puntos porcentuales)**, y el conjunto de opciones a ±3 puntos. Ninguna opción debería ganar contra todos los rivales: Rush hoy suma +12 puntos porcentuales sin contrapartida. Su valor tendría que depender del rival, por ejemplo de la velocidad y la evasión de sus tres cuartos. Esto es un criterio de diseño respaldado por la escala de los datos, no una medición.
5. **Pendiente para el motor (fuera de estos parámetros).** Hacen falta más puntos y tries (unos +8 puntos y +1 try por partido) y menos ruido por fase para tener más partidos cerrados. Por ejemplo, la probabilidad de quiebre y de try podría depender más del marcador o del territorio y menos de sorteos independientes. Hoy el 29 % de los partidos se define por ≤ 7 puntos, contra 42 % en la realidad.

**Resultado del prototipo** (§4): la localía, el porcentaje del local, el orden y la escala de los ratings y las probabilidades de los pares quedan dentro de los rangos empíricos. Newman–CASI con Newman local queda en **59,9 % (IC 56,8–62,9 %)**, apenas por debajo del rango 62–80 %, porque el objetivo es el modelo de margen, que es el más conservador. Si se quiere el valor central de ~68–70 %, alcanza con subir Newman 2 o 3 puntos de fuerza (a 85 u 86). Eso equivale a darle más peso a su récord en partidos cerrados. Es una decisión de criterio, y los datos no la resuelven.

## 6. Limitaciones e incertidumbre

- **Tamaño de muestra.** Un par de clubes juega 2 partidos por año. Los historiales de 16 a 21 partidos tienen intervalos de ±20 puntos porcentuales. Un rating de club de una sola temporada tiene un error estándar de unos 3 puntos (σ/√26). La localía tiene un error de ±0,44 puntos y varía entre temporadas (de −1 a +3,8). Parte de esa variación es real: depende de qué clubes descienden o ascienden y de las canchas.
- **Formato.** 2016 fue a una rueda, con 14 clubes. 2017–2025 fue Top 12, salvo 2022 (Top 13) y 2021 (formato COVID con segunda fase por zonas). 2026 volvió a Top 14 con dos ascendidos. Los ascensos y descensos cambian la composición del torneo cada año: Pucará, San Luis, San Martín y Lomas ya no están. La dispersión de 2026 (Champagnat y Los Matreros) es mayor que la de los Top 12.
- **Tendencia en el tanteo.** Los puntos subieron de 47–50 por partido (2016–2019) a 60 (2026). Los tries solo están disponibles para 2024 (52 partidos) y 2026 (146).
- **Fuentes.** ESPN tiene errores puntuales (parciales cargados como finales, un 0-0 sin cargar) y le faltan resultados de la segunda mitad de 2017–2018. Las tablas de Wikipedia tienen erratas y versiones desactualizadas. Cada decisión está registrada en `conflicts` y `gaps`. La sede de los playoffs posteriores a 2018 no se verificó; no afecta la localía porque esos partidos se excluyen.
- **Modelos.** Los modelos de margen (normal) y logístico difieren para los equipos dominantes. El primero subestima a Newman en 2026 por 4,4 victorias. Por eso se informa el rango y no un único valor.
- **Simulación.** Se usó la semilla de mundo 2026, tácticas predeterminadas y el XV inicial. No se modelan lesiones, cansancio a lo largo de la temporada ni entrenamiento. Las fuerzas propuestas valen para esta generación de planteles.

## Archivos

| Ruta | Contenido |
| --- | --- |
| `research/history/urba-results.json` | 1.347 partidos con fuente, conflictos, huecos y controles de tabla. |
| `research/history/analysis.json` | Localía, distribución, sorpresas, Elo, ratings y pares. |
| `research/history/sim-compare.json` | Motor actual, barridos de `edge` y forma, iteraciones, prototipo, variante lineal y tácticas. |
| `scripts/fetch-urba-history.mjs` | Descarga y normalización (caché en `URBA_HISTORY_CACHE` o en el directorio temporal del sistema). |
| `scripts/history-lib.mjs` | Funciones estadísticas compartidas. |
| `scripts/history-analysis.mjs` | Análisis empírico. |
| `scripts/history-sim-compare.mjs` | Comparación con el motor y prototipo de calibración, sobre una copia temporal. |

Después de este trabajo, `npm run build` termina bien y `npm test` pasa 24 de 24 pruebas. No se modificó el motor ni el catálogo.

## 7. Calibración aplicada (10/11/2026)

Se aplicó al motor real, con una diferencia respecto de la propuesta: en vez de fuerzas no monótonas, se corrigió la causa (la variación de cada club al generar planteles) y las fuerzas siguen el orden del ranking real 2024–2026.

- **Localía:** `HOME_EDGE = 0,62` (antes 0,16). Con 0,56 la ventaja medida quedaba en 1,8, por debajo del rango real.
- **Forma del día:** `DAY_FORM = 0,02` (antes 0,055).
- **Nivelación de planteles:** `levelClubSquad` desplaza en la misma cantidad a todos los jugadores de un club para que su XV promedie lo que promete su fuerza. Se conservan las diferencias entre jugadores y el progreso por entrenamiento.
- **Fuerza por club (Top 14):** Newman 91, CASI 88, SIC 87, Alumni 83, Hindú 81, Belgrano 81, CUBA 77, Los Tilos 77, Regatas 76, Buenos Aires C&RC 72, La Plata 72, Atlético del Rosario 69, Los Matreros 61, Champagnat 61. Ajuste por club amortiguado, proyectado sobre el orden real (regresión isotónica).
- **Tácticas (`TACTIC_TUNING`):** Rush con más penales y menos ganancia por presión (≈ +2,4 para una defensa coordinada como Newman, −2,1 para Regatas); pie Conservador ≈ 0; ruck Rápido ≈ +0,3 a +0,7.
- **Ligas guardadas:** versión de datos 4; migración que recalibra fuerza y nivela planteles sobre copias, sin tocar resultados ni alineaciones.

Medición con el motor real (`node scripts/engine-calibration-check.mjs --seeds 30 --pair-seeds 2000`, resultado en `research/history/engine-check.json`):

| Indicador | Motor anterior | Motor aplicado | Real |
| --- | ---: | ---: | ---: |
| Victoria / empate del local | 49,7 / 1,9 % | 53,0 / 2,4 % | 53,1 / 2,7 % |
| Ventaja local H | 0,48 | 2,09 | 2,0–2,8 |
| Desvío de ratings de club | 11,8 | 9,2 | 9,2 (8,1 × 1,13) |
| Error de ratings (RMSE) | 4,6 | 1,3 | — |
| Newman – CASI | 78 %, +15,4 | 59 %, +5,0 | 62–80 %, +5 a +6 |
| Newman – Hindú | 75 %, +14,2 | 67 %, +7,7 | 63–81 %, +6 a +7 |
| Newman – Regatas | 92,5 %, +26,8 | 75 %, +11,3 | 82–96 %, +13 a +15 |
| CASI – Regatas | 76 %, +13,4 | 68 %, +8,4 | 74–88 %, +11 |
| SIC – CASI | — | 55 %, +2,5 | 43–56 % |

Quedan fuera de este ajuste, porque dependen de la estructura del motor: partidos cerrados (28 % por ≤ 7 puntos contra 42 % real), puntos (45 contra 52,6) y tries (6,2 contra 7,2) por partido. Por ese exceso de azar por partido, con márgenes ya correctos los porcentajes de victoria quedan algo por debajo de los reales en los cruces desparejos.

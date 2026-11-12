# Trayectoria: tipo de fuente por temporada y revisión de identidades

Generado con `node scripts/build-player-trajectory.mjs` a partir de `urba-lineups.json` (sin descargas nuevas). Datos por jugador en `player-trajectory.json`: `seasonsBySource`, `officialSeasonsCount`, `pressOnlySeasonsCount`, `seasonsDisputed`; el detalle de la revisión está en `identityReview`.

## Tipos de fuente

- **Oficial:** URBA (urba.org.ar y su WordPress anterior) y ESPN (planillas jugadas).
- **Prensa:** Rugby Champagne (formaciones anunciadas antes del partido; pueden diferir de lo jugado).
- **Catálogo:** 2026 (planillas 2026 y planteles Ovalados).
- Una temporada con apariciones de ambos tipos cuenta como oficial.

## Totales (501 jugadores del catálogo)

- 352 jugadores tienen al menos una temporada oficial; 17 solo tienen temporadas de prensa (antes de 2026); 132 no tienen historial previo a 2026 (solo catálogo).
- 780 temporadas-jugador oficiales y 380 solo de prensa (más 501 de catálogo 2026).
- Por temporada (oficial / solo prensa): 2016 19/0, 2017 25/0, 2018 21/0, 2019 26/54, 2021 43/87, 2022 56/115, 2023 57/122, 2024 264/1, 2025 269/1. Las temporadas 2019–2023 dependen sobre todo de prensa; 2024–2025 son casi enteramente oficiales (ESPN).

Distribución de jugadores por nº de temporadas oficiales: 0 → 149, 1 → 139, 2 → 123, 3 → 36, 4 → 21, 5 → 15, 6 → 7, 7 → 4, 8 → 5, 9 → 2.
Por nº de temporadas solo de prensa: 0 → 296, 1 → 91, 2 → 55, 3 → 57, 4 → 2.

## Respaldo por club (temporadas-jugador)

| Club | Jugadores | Con ≥1 oficial | Temp. oficiales | Temp. solo prensa | % oficial | Playoffs 2016–2025 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Hindú | 34 | 29 | 117 | 12 | 91 | sí (2016–19, 21–23) |
| SIC | 32 | 28 | 108 | 9 | 92 | sí (8 temporadas) |
| Newman | 38 | 32 | 97 | 24 | 80 | sí |
| Alumni | 38 | 30 | 79 | 40 | 66 | sí |
| Belgrano Athletic | 38 | 28 | 66 | 37 | 64 | sí |
| Cuba | 36 | 23 | 58 | 20 | 74 | sí (2021–22) |
| Regatas Bella Vista | 39 | 31 | 59 | 46 | 56 | sí (2016) |
| CASI | 30 | 25 | 45 | 53 | 46 | sí (2025) |
| Champagnat | 36 | 21 | 21 | 0 | 100 | no (solo 2024–2025) |
| La Plata | 36 | 22 | 22 | 18 | 55 | no |
| Buenos Aires CRC | 41 | 32 | 53 | 48 | 52 | no |
| Los Tilos | 41 | 28 | 28 | 28 | 50 | no |
| Atlético del Rosario | 31 | 23 | 27 | 45 | 38 | no |
| Los Matreros | 31 | 0 | 0 | 0 | — | no (sin historial) |

Mejor respaldados: SIC, Hindú y Newman (llegaron a playoffs, con planillas oficiales de semifinales/finales desde 2016); Champagnat figura al 100 % solo porque todo su historial es 2024–2025 (ESPN). Peor respaldados: Atlético del Rosario, CASI y Los Tilos, cuyas temporadas 2019–2023 son casi solo prensa y nunca tuvieron planillas oficiales de playoffs en esos años (CASI solo 2025). Los clubes que no llegaron a playoffs no tienen contraste oficial antes de 2024.

## Revisión de identidades con planillas oficiales

Método: para cada temporada solo de prensa se compara cada partido de prensa con la planilla oficial del mismo partido y club (cuando existe). Un partido contradice si la oficial no incluye al jugador y en su mismo número figura otra persona del mismo apellido (otro nombre de pila, o mismo nombre con segundo apellido distinto). La temporada se marca dudosa (`seasonsDisputed`) y deja de contarse solo si hay 3 o más partidos contradichos y todos los partidos comparables la contradicen. La ausencia en una planilla aislada no contradice. Variantes del mismo nombre (Pablo/Paul, Alejandro/Alejo) no se toman como otra persona.

Alcance: de 381 temporadas solo de prensa, 48 (los clubes con planillas oficiales ese año: playoffs de 2016–2023 y ESPN 2024–2025) pueden contrastarse; las otras 333 no tienen ninguna planilla oficial del club ese año y quedan sin verificar (no contradichas). Los 25 jugadores de confianza «media» (nombres parciales o de otro club): 24 tienen al menos una temporada oficial que respalda el vínculo; solo Juan Segundo Campbell (Buenos Aires CRC) depende únicamente de prensa. Ninguna de sus temporadas de prensa es contradicha por una oficial.

### Temporada dudosa (no contada) — cambia `seasons` y `seasonsCount`

- **Ramón Fernández Miranda (Hindú), 2024.** Prensa lo pone de #12/#13 en 9 partidos de la fase regular; en esos mismos 9 partidos ESPN muestra a otro en ese número y nunca a él: Juan Fernández Miranda en 4 (p. ej. https://www.espn.com/rugby/match/_/gameId/598510/league/289279, .../598512, .../598532, .../598538) y «Ramon Fernandez de Caleya» en 5. Queda sin resolver si este último es otro jugador o él con otro segundo apellido. `seasons` pasa de [2024, 2025, 2026] a [2025, 2026]; `seasonsCount` de 3 a 2; `firstSeason` de 2024 a 2025. 2025 se conserva y es oficial: ESPN lista a «Ramon Fernandez» en los mismos números y partidos que prensa. **`research/catalog.json` no se modificó, así que su `trajectory.seasons` sigue en 3 hasta volver a ejecutar `scripts/apply-trajectory.mjs`.**

### Contradicción aislada (se conserva la temporada)

- **Jerónimo Ureta (Newman), 2021.** En la semifinal 2021 prensa pone a Jerónimo en el #4 y la planilla oficial a Tomás Ureta (https://urba.org.ar/prensa/formaciones-semifinales-del-urba-top-12-copa-directv-presentada-por-zurich). Es el único partido de 7 con planilla oficial y no alcanza el umbral. Su 2021 sigue siendo solo prensa.

### Observaciones sin cambios en `seasons`

- **Pablo y Paul Cardinal (Newman):** probablemente la misma persona con dos registros del catálogo (segunda línea y ala). En 2024 prensa dice «Paul» y ESPN «Pablo» en el mismo número (#4/#5) en los mismos partidos (https://www.espn.com/rugby/match/_/gameId/598485/league/289279); la semifinal 2023 de URBA lista a «Paul Cardinal» #19 (https://urba.org.ar/urba/formaciones-confirmadas-para-la-semifinal-entre-newman-vs-alumni). No se fusionan aquí.
- **Alejandro Daireaux (SIC):** ESPN y URBA escriben «Alejo»; es la misma persona (mismos números y partidos en 2024–2025, suplente en semifinal y final 2021). El vínculo automático no une Alejo con Alejandro, por lo que sus temporadas figuran como solo prensa pese a respaldo oficial con nombre alternativo.
- **Santos Panelo (Champagnat), 2024:** en 5 partidos prensa pone a Santos de #10 y ESPN a Benjamín Panelo (no está en el catálogo); Santos figura en ESPN como #10 en otros 17 partidos, por lo que 2024 es oficial (https://www.espn.com/rugby/match/_/gameId/598472/league/289279).
- **Juan Pablo y Juan Pedro Garoby (Cuba):** las planillas oficiales (2021, 2024) solo muestran a «Juan Pedro»; «Juan Pablo» no aparece en ninguna formación 2016–2025. Posible duplicado o nombre mal cargado en el catálogo.
- **Otras familias revisadas sin hallazgos (Camerlinckx, Bernasconi, Amaya, Cancelliere, Graglia, Prince, Bosch, Ulloa, Roger, Phelan, Paolucci, Tuculet, Fernández Armendáriz):** en los casos con temporada solo de prensa no hay planilla oficial del club ese año o los números coinciden; no hay contradicción. Una diferencia aislada Francisco Lescano / Franco Pastorino (CASI 2025, 1 de 2 partidos, apellidos distintos) tampoco alcanza el umbral.

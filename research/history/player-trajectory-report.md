# Trayectoria en el máximo torneo URBA: informe

Generado el 10/11/2026 con `node scripts/fetch-urba-lineups.mjs` (formaciones, con caché fuera del repositorio) y `node scripts/build-player-trajectory.mjs` (cruce con el catálogo).
Salidas: `research/history/urba-lineups.json` y `research/history/player-trajectory.json`.

## Qué se cuenta

Una temporada cuenta si el jugador figura (como titular o suplente) en al menos una formación publicada de un partido del máximo torneo URBA (Top 14 en 2016, Top 12 en 2017–2025, Top 13 en 2022) y si ese nombre se vincula con su registro del catálogo. 2026 cuenta si el jugador tiene apariciones 2026 en `catalog.json` o figura en un plantel Ovalados 2026; los 501 jugadores del catálogo tienen al menos esa temporada.

**El conteo indica las temporadas registradas desde 2016 y no la carrera completa.** No incluye temporadas anteriores a 2016, Primera A/B ni el exterior. Las temporadas con poca cobertura lo subestiman. 2020 no se jugó.

## Cobertura por temporada y fuente

| Temporada | Partidos con formación / total | % | Fuentes (partidos) |
| --- | ---: | ---: | --- |
| 2016 | 5 / 96 | 5,2 | URBA 5 (playoffs) |
| 2017 | 4 / 134 | 3,0 | URBA 4 (playoffs) |
| 2018 | 3 / 135 | 2,2 | URBA 3 (playoffs) |
| 2019 | 50 / 135 | 37,0 | Rugby Champagne 48, URBA 2 |
| 2021 | 63 / 99 | 63,6 | Rugby Champagne 60, URBA 3 |
| 2022 | 63 / 159 | 39,6 | Rugby Champagne 60, URBA 3 |
| 2023 | 105 / 135 | 77,8 | Rugby Champagne 102, URBA 3 |
| 2024 | 134 / 134 | 100 | ESPN 134 |
| 2025 | 131 / 135 | 97,0 | ESPN 122, Rugby Champagne 10 |
| 2026 | catálogo | — | planillas del catálogo y Ovalados |

En todos los partidos asignados hay formaciones de ambos equipos: un bloque suelto no se asigna. ESPN trae 23 jugadores por equipo; Rugby Champagne suele publicar solo los titulares; URBA, titulares y suplentes. La cobertura por club y temporada está en `coverage.byClub`.

- **ESPN:** la API de partido trae planteles desde 2024. Una muestra de 18 partidos de 2017–2023 y la revisión completa de los 135 partidos de 2023 no devolvieron planteles. Faltan 13 partidos de 2025, de los cuales 10 se completaron con Rugby Champagne.
- **URBA:** se revisaron 602 notas del WordPress histórico (wp-json, 2016–2025). Contienen formaciones de casi todos los playoffs y de pocas fechas regulares.
- **Rugby Champagne:** se analizaron 125 notas de formaciones candidatas del sitemap de la sección URBA y 98 tenían partidos previos a 2026 (94 con formaciones asignadas); las de 2026 se omiten. Las notas que solo traían apellidos (por ejemplo, la semifinal Hindú–SIC de 2021) no se usaron porque no permiten identificar a nadie.
- **Excluidas por robots.txt o política:** A Pleno Rugby (`Disallow: /` para agentes genéricos), Entre Palos (60 s entre pedidos y 3–6 documentos por hora: no permite un barrido) y ovalados.com. Por eso 2016–2018 quedan prácticamente sin cobertura de fase regular.

## Distribución de jugadores (501)

| Rango | Rótulo previsto | Jugadores |
| --- | --- | ---: |
| 1 | Debutante | 132 |
| 2–3 | Joven | 163 |
| 4–6 | Jugador de Primera | 162 |
| 7–9 | Experimentado | 41 |
| 10+ | Veterano | 3 |

Confianza: 476 jugadores «alta» y 25 «media». Hay 369 jugadores con al menos una temporada anterior a 2026; 132 solo tienen 2026. Primera temporada registrada: 2016: 19, 2017: 19, 2018: 4, 2019: 46, 2021: 74, 2022: 39, 2023: 49, 2024: 78, 2025: 41, 2026: 132.

Los tres jugadores con 10 temporadas (Agustín Capurro, Lautaro Bávaro y Federico Graglia, de Hindú) cubren toda la ventana. Como el techo efectivo es 10, el rótulo «Veterano» queda casi vacío por la ventana y no por los datos de carrera.

## Reglas de identidad

- Se usa la lógica de `samePerson` de `scripts/import-ovalados-2026.mjs`, copiada porque ese módulo ejecuta la importación al importarse. Además, el primer nombre de cada forma debe tener un equivalente en la otra.
- **Mismo club:** se acepta el único candidato con el mejor vínculo. Los vínculos son exacto, parcial (tokens de más, como «Juan Ignacio Martínez Sosa» frente a «Juan Martínez Sosa») o por inicial. Si hay empate entre candidatos, el nombre queda como ambiguo.
- **Otro club:** solo se acepta un nombre completo idéntico y único. Se rechaza si ese nombre también figura en el club propio del jugador en una temporada en que este ya juega allí, o si aparece en dos clubes la misma temporada.
- Una fecha de nacimiento acreditada descarta las temporadas en que el jugador tendría menos de 17 años. La fecha estimada de ESPN solo genera un aviso.
- Confianza «media»: alguna temporada se sostiene solo con un vínculo parcial, por inicial o con otro club.

## Casos dudosos y limitaciones

- **Vínculos parciales con nombres comunes:** «Pedro García» con Pedro García Colinas, «Hugo García» con Hugo Garcia Rafael, «Nicolás Fernández» con Vega Nicolas Fernandez y «Luis Martinez» (2024) con Luis Prieto Martínez. Todos están marcados como «media» y conviene revisarlos.
- **Cambios de club aceptados:** Lisandro Dipierri (Los Tilos 2021–22 → Atlético del Rosario) y Felipe Rubio (SIC 2024 → Atlético del Rosario).
- **Homónimos rechazados:** Joaquín de la Vega (Mendía), de Hindú 2017–2023, no se atribuye a Joaquín de la Vega de Newman. Tampoco se atribuyen Ciro Plorutti en Alumni 2025 (el del catálogo jugó en SIC) ni Tomas Cubelli de Belgrano a Tomás Cubilla de Alumni.
- **Huecos largos:** 26 jugadores no tienen registros en varias temporadas intermedias. En casos como Sebastián Cancelliere, Felipe Ezcurra o Guido Cambareri, coincide con etapas en el exterior; en otros, con años de baja cobertura (2016–2018). Se marcan en `notes`, pero no bajan la confianza.
- **Fecha estimada errónea:** `buenos-aires-crc-tobias-diaz-borda` tiene en el catálogo una fecha estimada de 2021-07-09 (ESPN). Se conservaron sus temporadas 2023–2025 y se dejó una nota.
- **`unmatchedNames` (79):** incluye 69 nombres con el mismo apellido y club que un jugador del catálogo pero otro nombre de pila (familiares o errores de transcripción: conviene revisarlos), además de ambigüedades y coincidencias parciales con otros clubes. Otros 1.706 nombres de formaciones no se vinculan con nadie del catálogo y corresponden a jugadores que hoy no están en él.
- **Clubes ascendidos:** Los Matreros (Top 14 desde 2026) y Champagnat (desde 2024) no tienen formaciones de Primera A, por lo que sus jugadores quedan con 1 o 2 temporadas aunque tengan muchos años en Primera del club. Si «temporadas en Primera» debe incluir otras divisiones, hace falta otra fuente.
- **Partidos sin formación publicada:** es un hueco documentado y no se completó con inferencias. Los partidos de 2025 sin ESPN ni Rugby Champagne figuran en `coverage.bySeason` y `coverage.byClub`.
- Rugby Champagne publica formaciones previas al partido, que pueden diferir de las que finalmente jugaron. URBA y ESPN reflejan la planilla del partido.

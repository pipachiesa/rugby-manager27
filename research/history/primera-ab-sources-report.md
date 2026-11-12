# Primera A y Primera B URBA: fuentes y formaciones (2016–2026)

Relevamiento del 10/11/2026. Script reproducible: `node scripts/fetch-urba-lineups-primera-ab.mjs` (caché crudo fuera del repo, compartido con `fetch-urba-lineups.mjs`). Salidas: `urba-lineups-primera-a.json` y `urba-lineups-primera-b.json` (mismo formato que `urba-lineups.json`, con `division`, marcador oficial y `catalogCrossmatch`). No se modificaron el catálogo, la trayectoria, `web/`, `src/engine` ni las pruebas.

## 1. Fuentes

| Fuente | robots.txt | Temporadas | Formaciones por partido | Planteles con nacimiento | Uso |
| --- | --- | --- | --- | --- | --- |
| **API del fixture de urba.org.ar** (`/api/fixture/menu`, `/api/fixture/championship/ID`, la usa la web nueva de la URBA) | no publica (404): sin restricciones | 2021, 2023–2026 con fechas y resultados; 2022 solo tabla; 2019–2020 vacías | No | No | **Índice oficial de partidos** (Primera A/B Superior y sus Play Off) |
| **Rugby Champagne** (sitemaps de sección `primera-division-a`, `primera-division-b`, `urba`, `urba/top-14`) | `Allow: /` | notas sueltas 2019, 2021, 2023, 2025 (y 2026) | Sí, en ~8 notas (de 1.445 y 1.438 URLs de las secciones A y B); las crónicas no traen formaciones | No | **Única fuente de formaciones** (prensa: anunciadas antes del partido) |
| ESPN API, liga `2009` «URBA Primera A» (`site.api.espn.com/.../rugby/2009/...`) | host sin robots.txt (403) | temporadas hasta 2016; 2026/2027 solo partidos sin jugar; nada de 2017–2025 | No (summaries 2016 con `rosters` vacíos) | No | Descartada. 2016 mezcla todas las divisiones URBA (984 partidos) |
| ESPN/Datafactory, canales `urbagrupo2` (Primera A) y `urbagrupo3` (Primera B) (`espn.datafactory.la/html/v3/htmlCenter/data/deportes/rugby/urbagrupo2/...`; ruta tomada de su propio `main_header.html`) | 404: sin restricciones | solo 2026 (185 partidos por división) | No: fichas con resultado y `players` vacío (26 fichas muestreadas) | No: `planteles.html` lista los 14 equipos sin jugadores | Descartada |
| WordPress anterior de la URBA (`urbaweb.azurewebsites.net/wp-json`) | sin robots.txt | 2016–2025 | No para Primera A/B (solo Top 12/14 y seleccionados) | No | Descartada |
| www.espn.com.ar (notas 6720007 y 6721712) | excluye agentes de IA | — | — | — | No consultada; se llegó a Datafactory por su propio host |
| ovalados.com, A Pleno Rugby | excluyen | — | — | — | No consultadas (regla del proyecto) |

**Planteles 2026 de Primera A/B:** ESPN/Datafactory no los tiene (página de planteles vacía, fichas sin jugadores), por lo que **no se creó** `research/espn-planteles-primera-ab-2026.json`.

## 2. Cobertura obtenida

Partidos con formación de al menos un lado / partidos del índice oficial (entre paréntesis, con ambos lados).

| Temporada | Primera A | Primera B | Nota |
| --- | --- | --- | --- |
| 2019 | 8 (8) / sin índice | 7 (7) / sin índice | Fecha 18 y repechajes. **Solo apellidos** (sin números ni nombres de pila): localía según el orden de la nota, sin fecha verificada |
| 2020 | — | — | sin torneo |
| 2021 | 1 (1) / 94 | 0 / 94 | final Atlético del Rosario–La Plata |
| 2022 | 0 / 182 | 0 / 182 | la API solo publica la tabla; no hay notas de formaciones |
| 2023 | 12 (10) / 182 | 7 (3) / 182 | fechas 9 a 11 del índice; lados «sin confirmar» quedan vacíos |
| 2024 | 0 / 185 | 0 / 185 | ninguna fuente |
| 2025 | 2 (1) / 185 | 1 (1) / 185 | promoción Top 12–Primera A San Luis–Champagnat (solo lado Champagnat; no está en ningún índice) y finales de promoción A/B y B/C |

Clubes del Top 14 2026 en Primera A según la API oficial (partidos con formación / jugados): 2021 La Plata 1/15, Atlético del Rosario 1/15, Champagnat 0/14, Los Matreros 0/14 · 2022 La Plata, Champagnat, Los Matreros 0/26 · 2023 Champagnat 2/26, Los Tilos 2/26, Regatas 2/26, Los Matreros 0/26 · 2024 La Plata 0/26, Los Tilos 0/28, Los Matreros 0/27 · 2025 Champagnat 0/26 (+1 promoción), Atlético del Rosario 0/26, Los Matreros 0/26. Por las notas de 2019: Champagnat, Los Tilos y Buenos Aires C&RC en Primera A y Los Matreros en Primera B.

Aunque casi no hay formaciones, la API sí documenta **qué temporadas jugó cada club en Primera A** (2021–2025): sirve para precisar el aviso «Historial incompleto» por club y temporada.

## 3. Cruce con el catálogo

Criterio de `scripts/build-player-trajectory.mjs`: nombre de pila compatible, mismo club preferido, ambiguos descartados, otro club solo con nombre completo idéntico y único, iniciales solo en el mismo club, edad < 17 con fecha acreditada descarta. Las 459 entradas con solo apellido (sobre todo 2019) **no se cruzan**. El formato invertido «Apellido Nombre» de la nota de 2025 se cruza por conjunto de tokens.

- **56 jugadores del catálogo** aparecen en formaciones de Primera A/B, en **62 temporadas**, todas ausentes de `player-trajectory.json` (55 vínculos exactos, 6 parciales del mismo club, 1 por inicial).
- Por club y temporada: Champagnat 2023 (10) y 2025 (13); Regatas Bella Vista 2023 (13); Los Tilos 2023 (10); Atlético del Rosario 2021 (10); La Plata 2021 (4); Buenos Aires C&RC 2019 (1, «A. Lamensa», por inicial, con un «F. Lamensa» en el mismo XV); Newman 2023 (1, Simón Prince en Ciudad de Buenos Aires, Primera B, otro club con nombre idéntico y único: verificar).
- Si se sumaran a la trayectoria, 28 de esos 56 jugadores cambiarían de rótulo (p. ej. 14 pasan de 2 a 3 temporadas y 6 de 2 a 4). Decidir si Primera A cuenta como «temporada en Primera» es una decisión de diseño pendiente; no se aplicó.
- Dudosos no vinculados (5): homónimos parciales de otros clubes (p. ej. «Tomás Jumilla» de Deportiva ≠ Tomás Cubilla de Alumni; «J. Sánchez» de San Cirano).

## 4. Huecos y advertencias

- 2022 y 2024 de Primera A, temporadas clave para La Plata, Los Matreros, Champagnat y Los Tilos, no tienen ninguna formación pública en las fuentes permitidas. Los Matreros no tiene formaciones de Primera A en ninguna temporada.
- Todo lo recopilado es prensa (formaciones anunciadas), no planilla oficial. 2019 no tiene índice oficial: fecha y localía no están verificadas.
- La API de la URBA vincula mal al equipo «San Andres» con el club San Albano: se usa el nombre del equipo. Su «Primera A - Play Off» de 2025 es la promoción A/B, no el título.
- Otras fuentes posibles no revisadas por estar fuera del encargo: sitios y redes de clubes, diarios (La Nación, Olé) y Rugbytime.

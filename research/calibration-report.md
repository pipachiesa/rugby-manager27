# Calibración del motor de Tercer Tiempo

## Valoración de jugadores

La valoración de 0 a 100 se calcula con el promedio ponderado de los atributos relevantes para el puesto. Los atributos van de 1 a 20. El promedio ponderado 1 corresponde a 0, 16,58 a 82 y 19,05 a 95. Para un pilar, scrum, fuerza y técnica suman 12 de los 20 puntos de peso. Para un apertura, decisiones, pase, visión y pie suman 13. El físico, la forma del día y el potencial de entrenamiento se guardan por separado.

La fuerza histórica de un club se usa en la generación inicial. Para el Top 14, la base individual es 10,9 más 0,071 por cada punto de fuerza del club por encima de 70. La misma fórmula usa bases 9,8 y 8,8 para Primera A y Primera B. La generación agrega perfiles posicionales, dispersión individual y ajustes de categoría de 0 para Primera, −1,25 para Intermedia, −2,40 para Pre A y −3,45 para Pre B. La categoría es una decisión de plantel dentro del juego. Los registros documentan identidades y puestos, mientras que los atributos son estimaciones del juego.

Planteles iniciales del catálogo 2026 con semilla de mundo 2026.

| Grupo | Jugadores | Media | Mín.–máx. |
| --- | ---: | ---: | ---: |
| Top 14, XV titulares | 210 | 62,14 | 46–81 |
| Newman, XV titular | 15 | 70,07 | 63–81 |
| Newman, Primera | 28 | 69,54 | 57–81 |
| Newman, Intermedia | 3 | 58,33 | 53–61 |
| Newman, Pre A | 14 | 55,43 | 50–63 |
| Newman, Pre B | 15 | 49,33 | 42–57 |
| Newman, M19 | 15 | 51,40 | 44–61 |
| Newman, M17 | 15 | 46,73 | 33–59 |
| CASI, XV titular | 15 | 66,20 | 55–79 |
| Regatas Bella Vista, XV titular | 15 | 60,40 | 49–73 |
| Registro activo en el exterior | 46 | 80,96 | 73–87 |
| Jugadores activos en el exterior citados en la convocatoria de Los Pumas del 9 de noviembre de 2026 | 29 | 81,48 | 76–87 |

En esta generación, el máximo de Newman es Justo Ortiz Basualdo, con 81. La valoración proyectada de Julián Montoya es 86. El grupo de la convocatoria se seleccionó por el identificador de fuente `arn-pumas-nov09-2026` en los registros activos del archivo `returns.json`. Incluye convocados recientes y jugadores consolidados.

## Cómo se simula un partido

La efectividad de cada atributo parte de la habilidad base y la multiplica por `0,72 + 0,28 × físico / 100`. El desgaste durante el partido es proporcional a los minutos jugados. Su ritmo es `0,17 − 0,006 × resistencia` por 80 minutos. La forma del día usa la suma de dos sorteos uniformes centrados para dar un factor de equipo entre −5,5 % y +5,5 %, con mayor densidad cerca de cero. La ventaja de local añade 0,16 puntos de habilidad al equipo atacante en el cálculo del avance y en el duelo de formaciones.

| Fase | Qué decide el duelo |
| --- | --- |
| Ataque abierto | El armado y el canal dependen del esquema. Se combinan pase, manejo y decisiones para la recepción. Por afuera se enfrentan evasión, velocidad, aceleración y visión con tackle y ubicación. Por adentro pesan acarreo, fuerza y técnica. La ruptura y los metros tienen sorteos separados. |
| Ruck | Se comparan destreza en el ruck, trabajo y apoyo. El ruck rápido da velocidad y metros extra y aumenta el riesgo de error y recuperación rival. |
| Scrum | El 76 % del índice viene de la primera línea y el 24 % del resto del pack. Estable mejora la retención propia. Presión disputa más la pelota rival y puede dejar espacio si el rival conserva. |
| Lineout y maul | El lanzamiento del hooker pesa 48 % en el lineout y los saltadores 52 %. Competir disputa la recepción a cambio de espacio si falla. Un maul se arma desde un lineout ganado en zona de ataque y enfrenta maul, fuerza y técnica de ambos packs. |
| Pie | El atributo de pie y la política de juego cambian frecuencia, distancia y búsqueda del touch. A los palos influyen puntería, temple, distancia y ángulo. |
| Defensa y disciplina | Rush aumenta la presión con una línea coordinada. Si la superan por afuera, deja más espacio. La disciplina y las decisiones influyen en penales. |

Cada fase modifica el territorio y las opciones de la siguiente. Los cambios introducen al suplente en el cálculo de las fases y en la repetición. Cada acción con puntos tiene su propio instante. Los cuadros muestran el último marcador registrado en ese instante. Las partidas guardan la geometría compacta y el registro de eventos para reconstruir la misma repetición después de cambiar la formación o entrenar.

## Pruebas con semillas

Se generaron 1.000 partidos por fila, con semillas de partido enteras de 0 a 999. Newman fue local en todas las filas. Se usó el XV inicial y la táctica predeterminada salvo el factor indicado. El clon de Newman tiene iguales atributos por camiseta. Los porcentajes estiman la frecuencia de victoria en el simulador para cada escenario. El intervalo de Wilson refleja la precisión muestral de esa frecuencia. La dispersión del margen indica los percentiles 10 y 90 del puntaje local menos el visitante.

| Visitante y cambio | Victorias | Empates | Derrotas | Puntos medios | Margen p10 a p90 |
| --- | ---: | ---: | ---: | --- | --- |
| Clon idéntico, físico 100 de ambos lados | 520 | 38 | 442 | 23,66 a 22,90 | −23 a +24 |
| CASI, 66,20 frente a 70,07 del XV de Newman | 781 | 25 | 194 | 30,88 a 15,43 | −7 a +39 |
| Regatas Bella Vista, 60,40 frente a 70,07 | 925 | 9 | 66 | 38,13 a 11,31 | +3 a +51 |
| Clon con físico 70 contra Newman con 100 | 853 | 22 | 125 | 34,49 a 13,83 | −3 a +44 |
| Clon idéntico, Newman cambia Drift por Rush | 640 | 31 | 329 | 25,44 a 18,32 | −15 a +31 |
| Clon idéntico, Newman cambia Asegurar por Rápido | 466 | 38 | 496 | 23,56 a 24,53 | −24 a +23 |
| Clon idéntico, visitante cambia Territorial por Conservador | 614 | 29 | 357 | 27,52 a 20,89 | −17 a +31 |

El intervalo del 95 % para la victoria local es 48,9–55,1 % con XV idénticos, 75,4–80,6 % frente a CASI y 90,7–94,0 % frente a Regatas. Estas tasas describen escenarios de calibración del juego, sin ajuste estadístico a resultados históricos de partidos individuales.

En otra prueba de 1.000 semillas por táctica, se usó el Newman generado sin catálogo. Se fijó su físico en 85, la ubicación y disciplina en 7 y la aceleración en un máximo de 10. Frente al clon sano, Drift ganó 142 partidos y concedió 31,56 puntos en promedio. Rush ganó 91 y concedió 36,90. La diferencia ilustra el costo de presionar con una línea mal coordinada.

Los cambios de alineación o táctica pueden cambiar la rama que consume el siguiente sorteo, incluso si se conserva la semilla. Para aislar la variación del partido se fijaron todos los jugadores y las tácticas en la primera fila y se variaron solo las semillas. Para medir sensibilidad se compararon distribuciones completas. El modelo no asigna un porcentaje fijo de «suerte» a un resultado.

## Regresos

El mercado toma jugadores activos en el exterior con un club de origen documentado que esté disponible en la liga. Una edad desconocida permite seguimiento, pero bloquea el contacto. El umbral de edad para el contacto es 29 o 31 según la valoración proyectada. La simulación estima desarrollo hasta los 27 y descenso de valoración desde los 32. La predisposición combina la edad y la habilidad proyectada y tiene un tope de 74 %. La ventana de disponibilidad se sortea una sola vez por jugador y temporada, con una respuesta adicional por fecha. Cada club puede hacer un contacto por fecha. Para firmar se requiere una respuesta favorable y un cupo único por identidad en el club de origen. La predisposición representa una mecánica de juego.

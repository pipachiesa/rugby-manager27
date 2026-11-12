# Playtest de interfaz: Tercer Tiempo (12/11/2026)

Entorno: servidor local en 127.0.0.1:4173 (ya estaba corriendo, no lo toqué), Chrome, pestaña nueva (cerrada al final). No edité archivos del proyecto. No usé «Empezar de nuevo». Club: Regatas Bella Vista (Top 14); no usé el selector de escudo para un club de Primera B. Jugué 10 fechas (de 26). La vista de celular (375 px) se probó con un iframe de 375 px sobre la misma página, porque redimensionar la ventana no cambió el viewport.

Resultados de la partida: G 29-26 MAT, G 42-14 ADR, G 45-22 TIL, P 12-45 CASI, P 27-49 CUBA, G 37-14 BAC, P 24-34 BEL, P 22-34 SIC, G 33-7 Newman, P 13-31 Alumni. Quedé 8º con 18 pts a la fecha 6 y objetivo "mitad de arriba".

## ROTOS (broken)

1. **La repetición se rompe con una excepción y se congela.**
   - Pasos: Continuar en la fecha 1, tocar la cancha para reproducir, subir a 4x y dejar correr. A los 34:22 (tras una conversión de Juan Francisco Morales) el reloj se frenó para siempre (marcador 14-5), los jugadores quedaron apiñados en el ingoal y «Pausar» siguió mostrándose como si corriera.
   - Consola: `TypeError: Cannot read properties of undefined (reading 'x')` en `drawReplay` (app.js:1315, `position(player, b.players[i] ?? player)`), llamada desde `animate` (app.js:1426). `a.players[i]` es undefined: algún fotograma tiene menos jugadores que los 30 puntos dibujados.
   - Segunda vez: la misma excepción salió en `finishReplay` (app.js:1415) al tocar «Saltar al resultado» → «Mostrar resultado» en otro partido. Ahí el marcador final no se pintó: leí «RBV 0 – 0 NEW» justo después de confirmar, cuando el resultado real (fixture) era 33-7. Es decir, al revelar el resultado el marcador de la repetición puede quedar en 0-0.
   - Esperado: la repetición llega a 80:00 sin errores, y el salto muestra el marcador final.
   - Otras reproducciones: de 4 partidos vistos (dos a 4x, tres saltados) falló 1 reproducción y 1-2 saltos; la segunda reproducción completa (fecha 2, 4x) terminó bien con 14-42.
   - No encontré el fotograma exacto; conviene recorrer `match.frames` buscando `players.length !== 30` y proteger `drawReplay`.

## MOLESTOS (annoying)

2. **Cancha y controles no entran juntos en la pantalla del escritorio (1470x801).** La cancha ocupa casi toda la altura; el botón Pausar, 1x/2x/4x y el relato quedan debajo y hay que hacer scroll mientras corre el partido. Con la cancha vista completa no se ve el relato. En celular entra todo bien (la cancha queda chica, ~208 px de alto).
3. **Al salir de la repetición se pierde el progreso.** Fui a Posiciones y volví con «Ver partido»: el partido arrancó otra vez en 0-0, 00:00 (no recuerda el minuto).
4. **No hay formulario de edición de jugador en la partida de prueba, ni para reales ni para ficticios.** La ficha de Tomás Barbaccia (ficticio) y la de Santiago Cordero (real) solo muestran la nota «Iniciá sesión en Liga para corregir datos de jugadores reales.» No hay recuadro «Editar jugador» ni botón «Editar» (AGENTS.md dice que el ficticio se edita en la partida y que en la partida de prueba con servidor también). No pude abrir el formulario. Si el diseño es que el invitado no edita, falta el botón deshabilitado o una explicación; si debería haber, es un bug.
5. **Suplentes mal armados.** En Tácticas (fecha 4) los 8 suplentes eran: 4 alas/wings (Terra, Tommasini, Reznick, Cordero F.), un pilar (Barbaccia), un apertura. No hay hooker, segunda línea ni medio scrum suplente. Una vez usado el XV automático por lesiones, nadie cubre esos puestos en el banco.
6. **«Resto del plantel» es casi inútil.** Lista de relleno de nivel 21-53 con el puesto «Ala» para casi todos (Valentín Bourse, Santiago Franzini, Felipe de la Torre, etc.). Cuesta creer que sean todos alas; probablemente es el puesto principal asignado por defecto a los inventados.
7. **Mercado: orden por «Más interesados» sube basura.** Primeros resultados: jugadores de nivel 13-18 de Vicentinos con 79% de interés. No ayuda a buscar buenos jugadores; el orden por defecto debería poner nivel o relevancia.
8. **Mercado: ofrecer «Titular en el XV» a un jugador de nivel 42 (el mío tiene 72 en el puesto) da 85% de interés y lo acepta con la promesa de ser titular.** Es un exploit: la promesa se registra pero no tiene consecuencia (se sabe, AGENTS lo anota). Además, en el chip de rol seleccionado el estado activo apenas se distingue en la captura.
9. **Buzón crece sin control.** «13 sin leer» en la fecha 4, «29 sin leer» en la fecha 8. Hay un «Ver todos (13)» pero no «marcar todo como leído» (no lo busqué a fondo).
10. **Pantalla Tácticas con cambios sin guardar y panel abierto.** Con el panel de Tácticas abierto, la barra «Cambios sin guardar» queda tapada y los botones Descartar/Guardar XV no se ven; hay que cerrar el panel. Guardar tácticas deja el panel abierto y vuelve el scroll al inicio del panel (una señal tipo «Guardaste el plan de juego» aparece pero no cierra).

## DETALLES (polish)

11. **Nombres repetidos en el XV.** «Camerlinckx» aparece 6 veces en la formación inicial (Marcos, Enrique, Justo, Mateo, Cruz, Felipe): el hooker, N8, apertura, centro, wing y fullback. Los nombres cortos en la camiseta quedan idénticos y confunden. Más del 40% del XV con el mismo apellido se ve raro aunque sea una familia típica del club.
12. **Chips de valoración y puesto superpuestos con la camiseta** en la cancha de Tácticas (el chip «72 PL · 100%» pisa el dorsal de las filas apretadas: primera línea y segunda línea). Pasa en escritorio y en celular.
13. **«Competiciones» se trunca como «Competicio...»** en la barra inferior del celular.
14. **Toast viejo persiste.** El toast «Guardaste el plan de juego.» siguió visible después de navegar a Desarrollo.
15. **Entrenamiento:** después de usar la sesión, la ficha sigue mostrando «Es titular: si lo entrenás ahora llega al partido con 80% de físico» y un segundo recorte 90% → 80%, como si aún pudiera entrenarse. El costo fue 100% → 90% (10 puntos, como dice AGENTS) y la valoración subió 76 → 77 (+1). La tarjeta de resumen «Físico medio» no cambió (redondea a 100%).
16. **Club:** «Fundación 1895-02-14» se muestra en formato ISO. La palabra «Ilustración aproximada» sigue visible bajo las camisetas, aunque AGENTS dice que esas marcas se quitaron. Hay dos «Temporada 2026»: la tabla del juego y «Temporada 2026 real» (8º, 26 PJ, 56 pts) conviven y se pueden confundir con la partida en curso.
17. **Estado «Competiciones» resaltado durante la repetición** en la barra superior: el partido no tiene entrada propia; aceptable.
18. **Cancha:** el público (puntitos de colores) es un patrón muy ruidoso y cansa a la vista; los carteles se ven bien. El nombre del jugador sobre el portador se superpone a los puntos.
19. **Scoreboard del replay:** al empezar la repetición «Tácticas» nav aparece resaltado en hover por el puntero (artefacto de prueba).

## Lo que funcionó bien

- Portal: buzón, próximo partido, informe del rival (modal con XV probable, plan habitual), tabla con zonas, «Esta semana», «Otras categorías». Muy claro.
- Tácticas: tocar una camiseta y después otra o un suplente funciona; «Guardaste el XV inicial.» y el panel lateral (mentalidad, ataque, defensa, pie, ruck, scrum, lineout, maul, penales) se guardó y se reflejó en el subtítulo («Ofensiva · 1-3-3-1 · Drift...»). Los lesionados se reemplazan solos (Cordero fue reemplazado por Rugolo; Toledo por Mañan).
- Entrenamiento: +1 con costo de físico, texto claro, atributos resaltados por puesto.
- Centro médico: lesionados, semanas, historial, «Más lesionado». Las lesiones largas (8 semanas) aparecen en el buzón.
- Mercado: filtros, rol ofrecido, contacto, toast de aceptado («...aceptó sumarse... con la promesa de ser titular») y de rechazo («Juan Zeiss no aceptó: prefiere seguir en Vicentinos»), un contacto por fecha y botón desactivado.
- Competiciones: tabla con zonas (barra azul 1º-4º), racha, bonus, PF/PC; fixture con filtro por club; la pestaña de la fecha pendiente dice «Mostramos la tabla y los resultados hasta la fecha anterior…» con botón «Ver partido» (no hay spoilers hasta revelar). Confirmé que la tabla (18 pts, PF 192, PC 170) coincide con los 6 resultados jugados.
- Recarga a mitad de partida: la partida continuó en la fecha 2 con el resultado, el buzón y los cambios guardados.
- Salto: el diálogo «¿Mostrar el resultado?» con «Seguir viendo» y «Mostrar resultado» funciona y no adelanta nada antes de confirmar.
- Tries/conversiones: el cartel «¡CONVERSIÓN!» con el nombre del pateador a todo el ancho de la cancha, con los colores del equipo, se ve bien (lo vi en pantalla). No vi un «¡TRY!» ni penal fallado en pantalla (no logré captarlos).
- Celular (375 px): Plantel (tabla con jugador, puesto, nivel, físico), Tácticas (cancha vertical y botón Tácticas), Posiciones (Pos., Club, PJ, Dif., Pts con tabs) y Portal (próximo partido, último resultado) se ven limpios, sin scroll horizontal (`scrollWidth` 371 en ancho 371), con barra inferior de 5 entradas. La repetición cabe entera con controles 1x/2x/4x grandes.

## Consola

- 2 excepciones (la misma, ver «Rotos» 1): `TypeError ... reading 'x'` en `drawReplay`, una desde `animate` y otra desde `finishReplay`. Ningún otro error ni aviso.

## Cómo se siente el bucle

Claro y adictivo en lo básico: preparar (XV, plan, sesión) → Continuar → ver partido o saltar → tabla. El flujo de saltar es ágil. Los resultados parecen razonables (4 victorias de 6 con un XV de nivel 65), aunque marcadores como 45-22 o 49-27 son altos (se sabe: ~48 puntos por partido). La falta de consecuencias de las promesas del mercado y un buzón que se llena sin filtro quitan sentido a la gestión; lo más urgente es arreglar el cuelgue de la repetición.

## Prioridad

1. Roto: excepción en `drawReplay`/`finishReplay` (congela la repetición y deja el marcador en 0-0).
2. Molesto: cancha+controles no entran juntos en escritorio; repetición sin memoria; falta de botón de edición; suplentes sin hooker/2ª línea/medio scrum; orden del mercado; buzón sin límite.
3. Detalles: apellido repetido, chips superpuestos, formatos y textos.

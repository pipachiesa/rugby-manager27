# Rugby Manager 27 — Estado del proyecto y traspaso para Claude

- **Actualización:** 13 de noviembre de 2026
- **Nombre público:** Rugby Manager 27 (RM27)
- **Carpeta de trabajo en el Mac:** `/Users/felipechiesa/Desktop/RM26/rugby-manager`
- **Código publicado:** [pipachiesa/rugby-manager27, commit 259e0d6 en main](https://github.com/pipachiesa/rugby-manager27/commit/259e0d6d4722a7829065d68db7edd89258fc55c1)
- **Web activa:** [Rugby Manager 27](https://tercer-tiempo-5bcc6746db3d.pipachiesa.workers.dev/)
- **Versión de datos:** `DATA_VERSION = 20` en `web/domain.js`.

## Qué quiere construir Felipe

Un manager de rugby argentino para jugar en el navegador, tanto en una carrera individual como en una liga privada con amigos. Regatas Bella Vista es el club inicial y prioritario para comprobar datos. Los clubes deben tener niveles, planteles y trayectorias distintos. La formación, la táctica, el desarrollo y el estado físico deben importar sin convertir el resultado en una certeza.

La interfaz toma como referencia la densidad y la navegación de Football Manager. Mantener el portal de cuatro columnas en escritorio, los perfiles individuales y la adaptación a móvil. El nombre visible es Rugby Manager 27. RM27 sirve como abreviatura cuando falta espacio. Se retiró el logo de producto de la cabecera y se conservaron los escudos de clubes y el icono de pestaña. El pie tiene [Contacto](mailto:felipechiesa05@gmail.com).

Si Felipe pide delegación, su preferencia registrada es que el agente principal dirija y revise, con Sol de razonamiento medio para tareas complejas y Terra de razonamiento alto para integración, tareas repetitivas y validación. Antes de cambiar reglas de juego, identificar qué parte es un requisito, qué parte proviene de una fuente y qué parte es un supuesto de simulación.

## Cómo se juega hoy

| Área | Comportamiento |
| --- | --- |
| Entrada web | Iniciar sesión o crear cuenta, elegir modo offline o liga con amigos y, para una partida nueva, indicar nombre de mánager y club. La entrada autónoma usa un perfil local. |
| Modo offline | Guarda la carrera en el navegador y permite retomarla sin elegir nuevamente club o mánager. Cambiar de modo conserva el guardado. Reiniciar pide confirmación. |
| Liga privada | Crear una liga o unirse con un código de 12 caracteres hexadecimales. Puede abrirse una liga guardada directamente. La invitación también puede venir como `?code=…` o `#liga/…` y se precarga en el formulario. |
| Avance online | Cada mánager marca «Estoy listo». Al marcarlo el último, el servidor simula la fecha o inicia la temporada siguiente según corresponda. El servidor valida membresía, club y versión. Cada participante conserva su propio estado de repetición vista. |
| Portal | Buzón con informes y hechos de la partida, próximos partidos, tabla, líderes de Primera, categorías del club e informe del rival. |
| Plantel y perfil | Puestos principal y secundarios, formación, 26 atributos de 1 a 20, nivel por puesto sobre 100, proyección de desarrollo, estado físico, estadísticas y trayectoria. |
| Gestión deportiva | XV y suplentes, tácticas, entrenamiento colectivo e individual, reconversión de puestos, promociones de cantera, rotación, fatiga y lesiones. |
| Mercado | Contactos locales que consideran rol, minutos, cercanía y división. Seguimiento de argentinos en el exterior con datos documentados. La predisposición y el fichaje pertenecen a la simulación. Los jugadores que salen al exterior dentro de la carrera conservan identidad e historial y pueden regresar más adelante al club de origen. |
| Temporada | Top 14, Primera A y Primera B de URBA. Fase regular, playoffs, ascensos y descensos. El fixture inicial se basa en el calendario 2026 y los posteriores se generan. Intermedia, Pre A, Pre B, M19 y M17 tienen resultados de equipo mediante un modelo paralelo simplificado. |
| Partido | Motor determinista por semilla. Replay 2D de Primera con 30 jugadores y pelota, fases, portador, pausas, velocidades y relato sincronizado. Arranca en 0–0. La tabla, los marcadores y las estadísticas de la fecha pendiente se revelan al finalizar o al confirmar el salto. |

La base incluye **42 clubes URBA jugables y 58 clubes en catálogo**. El Interior aparece como referencia. Primera, Intermedia, Pre A y Pre B comparten plantel superior, con asignaciones de juego. Las categorías paralelas tienen marcadores de equipo. Las estadísticas individuales y las repeticiones corresponden a Primera.

## Cantera, nivel y datos documentados

- Cada temporada ingresa una camada nueva de **15 M17**, un XV completo con **8 forwards y 7 backs**. Puede coexistir con la camada anterior. El motor cubre vacantes según la categoría y promueve M17 a M19 y M19 al plantel superior. Para documentados con edad desconocida usa permanencia de juego en la categoría y conserva la fecha de nacimiento como desconocida.
- La convocatoria oficial URBA M17 2026 aporta **28 jugadores de 12 clubes**. Los cuatro de Regatas son **Baltazar Estrada** (pilar izquierdo), **Facundo Moreira** (hooker), **Ramiro Santa Ana** y **Juan Segundo Fresca** (alas). El puesto sale de códigos oficiales de posición. Los registros permanecen sin edad verificada cuando falta respaldo. [Convocatoria de URBA](https://urba.org.ar/noticias/victoria-del-seleccionado-de-buenos-aires-m17-ante-tucuman-por-el-argentino-juvenil-m17) · [Planilla del plantel](https://weburba48bc11f634.blob.core.windows.net/blobweburba48bc11f634/wp-content/uploads/2026/11/261029-urba-m17-nfl.pdf)
- El tratamiento vigente de convocados usa un **objetivo de nivel inicial alrededor de 44/100** y una **proyección inicial de al menos 74/100**, con máximo de 85 en esa fórmula. Los valores exactos dependen del jugador y su posición. El ajuste anterior de solo dos puntos quedó superado. La proyección se revisa con el desarrollo, el entrenamiento, la edad y la evidencia de partidos. Puede superarse dentro del modelo. Una sesión individual consume estado físico y puede producir una mejora.
- El ajuste juvenil de 2026 usa las tablas documentadas de `research/urba-youth-tables-2026.json`, con Regatas como campeón M17 y Newman como campeón M19. `levelYouthByTables` calibra las categorías por separado. La regla de tablas se aplica al mundo 2026.
- Los reservas generados siguen una jerarquía inicial por nivel y la asignación se vuelve a evaluar durante la carrera. En la migración v16 se reorganizan las categorías superiores sin reducir atributos. Las recalibraciones específicas de fuerza y juveniles tienen sus propias condiciones.

### Fuentes y límites

Conteo directo de los JSON en el commit publicado:

| Archivo | Contenido comprobado |
| --- | --- |
| `research/catalog.json` | 58 clubes, 1.052 identidades de jugadores, 40 con nacimiento en el JSON base, 594 registros de fixture incluyendo Interior. El calendario de la fase regular jugable tiene 546 encuentros. |
| `research/youth.json` | 282 registros, incluidos los 28 convocados M17 2026. |
| `research/returns.json` | 49 perfiles, 46 documentados en el exterior y elegibles para el modelo de mercado. La elegibilidad de cada partida depende también de sus reglas y estado. |
| `research/age-verification.json` | Evidencia adicional que el empaquetador une al catálogo. Los 40 nacimientos de arriba corresponden al archivo base, previo a esa unión. |
| `research/history/` y `research/playtest/` | Resultados históricos, planillas, informes de calibración y simulaciones de carrera. |
| `research/names.json`, `research/club-kits.json`, `research/club-locations.json`, `research/club-honours.json` | Nombres para planteles ficticios, diseños de camisetas, ubicación y palmarés. |

El corte retrospectivo inicial es **10/11/2026**. Una aparición histórica acredita la identidad y el contexto de esa planilla. Para afirmar afiliación actual, nacimiento o puesto hacen falta fuentes que acrediten cada dato. La interfaz distingue nacimiento verificado, edad aproximada y edad sin dato. Los aportes comunitarios quedan diferenciados de las fuentes documentales. Usar fuentes públicas deportivas y evitar padrones electorales, cuentas privadas o completar edades y puestos por inferencia. Matías Medrano figura documentado en Benetton y debe evitarse su duplicación local. Las ilustraciones de camisetas llevan esa indicación.

## Mapa del código

| Ruta | Dónde trabajar |
| --- | --- |
| `web/index.html`, `web/style.css`, `web/app.js` | Aplicación web, rutas por hash, entrada, portal, plantel, perfil, mercado, cantera, torneo, replay y controles online. |
| `src/engine/index.ts` | Fuente del motor. Reglas por posición, atributos, ponderaciones, táctica, eventos, replay, evolución, retiros, salidas y regresos. |
| `web/engine.js` | Salida generada por el build a partir de TypeScript. Cambiar la fuente y recompilar. |
| `web/domain.js` | Integración de catálogo, reglas de ronda y temporada, mercado local, juveniles, lesiones, torneos paralelos, playoffs y migraciones. |
| `web/player-stats.js` | Registro compacto individual por fixture y temporada, cobertura y agregados. `playerCareerStats` admite `throughRound` para ocultar la fecha pendiente. |
| `server/worker.js` | API de cuenta y sesión, ligas y acciones, contribuciones y persistencia R2. |
| `server/local.mjs` | Adaptador de desarrollo Node, datos de prueba en `.local-data/`, puerto 4173. |
| `scripts/merge-research.mjs` | Combina fuentes y datos adicionales en el catálogo de distribución. |
| `scripts/build.mjs`, `scripts/build-standalone.mjs` | Generan el Worker con recursos embebidos y el HTML autónomo, respectivamente. |
| `wrangler.jsonc`, `.openai/hosting.json` | Configuraciones separadas para Cloudflare directo y el proyecto anterior de Sites. |
| `tests/`, `src/engine/index.test.ts` | Pruebas de motor, servidor, estadísticas, importaciones, migraciones, carreras y empaquetado. |

### Arranque y validación local

Node **26** es la versión usada y documentada para el build. El juego y sus pruebas actuales no requieren instalar dependencias de aplicación.

```sh
npm run build
npm test
npm run dev
```

Abrir `http://127.0.0.1:4173`. El servidor escucha en loopback por defecto. `LAN=1 npm run dev` lo abre a la red local para probar un teléfono en el mismo Wi-Fi. La identidad de desarrollo es de prueba. Cerrarlo al terminar y mantener los datos de prueba fuera de Git.

Para generar un HTML autónomo de prueba:

```sh
node scripts/build-standalone.mjs /tmp/Rugby-Manager-27.html
```

El HTML autónomo corre el modo offline. La persistencia depende de IndexedDB en el navegador donde se abre. El sitio HTTPS es el acceso para ligas a distancia. El build del Worker genera `dist/server/index.js` con el catálogo y los recursos. Mantener el alias de `trajectoryLabel as stageLabel` y el empaquetado aislado de módulos al tocar el build autónomo.

## Persistencia, estadísticas y migraciones

- **Offline:** IndexedDB `tercer-tiempo`, store `saves`, clave `demo`. Guarda `world`, `clubId`, `manager` y fecha del guardado. El identificador conserva el nombre histórico para recuperar partidas existentes. El origen del navegador separa los guardados de localhost, HTTPS y HTML autónomo. La sesión de pestaña recuerda el modo abierto y el código de la liga para recargas. El perfil autónomo y las preferencias usan almacenamiento del navegador.
- **Online:** `GET /api/me` devuelve estado de sesión. Registro, login y logout usan `POST /api/auth/{register,login,logout}`. `GET /api/leagues` enumera membresías, `POST /api/leagues` crea una liga, `GET /api/leagues/:code` carga su proyección, y `POST /api/leagues/:code/{join,action}` permite unirse o actuar. `/api/community` gestiona aportes sobre identidades documentadas. El servidor proyecta los datos para el miembro y valida su club. Las acciones usan versión de liga y escritura condicional con ETag. Un conflicto requiere recargar el estado antes de insistir.
- **Estadísticas:** registrar los hechos disponibles antes de compactar repeticiones o sustituir fixtures de temporada. Mantener IDs de jugador y de fixture. El registro de Primera puede conservar partidos, titularidades, minutos, tries, conversiones acertadas e intentadas, penales, drops, tarjetas y puntos. Un valor sin cobertura queda desconocido. La precisión de conversión tampoco se calcula cuando no hubo intentos. Los totales, líderes y últimos partidos respetan el corte de la repetición pendiente.
- **Migraciones:** `migrateWorld` registra primero estadísticas recuperables y aplica pasos condicionados por versión. v16 reorganiza categorías superiores. v17 completa las camadas parciales anteriores de 8 a 15 sin duplicar juveniles. v18 incorpora la convocatoria M17 si corresponde a 2026 o 2027 y evita inventarle recorrido en partidas más avanzadas. v19 ajusta nivel y proyección de convocados existentes. v20 recalibra categorías juveniles 2026 usando sus tablas. Conservar identidad, formación, partidos jugados y progreso al agregar cambios. Ejecutar la migración dos veces en una prueba debe resultar idempotente.
- **Siguiente temporada:** archiva estadísticas y campeones, resuelve ascensos y descensos, completa la cantera, reorganiza el plantel y reinicia la ventana de contactos. Lesiones largas pueden continuar. El registro de temporadas debe mantenerse aunque el fixture y los replays de la temporada anterior se compacten.

## GitHub y Cloudflare

**GitHub.** El remoto `origin/main` fue verificado en `259e0d6d4722a7829065d68db7edd89258fc55c1`. En la carpeta original, `.git` tenía permisos de solo lectura durante el último trabajo y `HEAD` seguía en `cb99338`, con los cambios de la publicación visibles en el árbol de trabajo. El push se hizo desde un clon temporal mediante fast-forward. En otro entorno, empezar con un clon actualizado o revisar `git status` y `git ls-remote origin refs/heads/main` antes de reconciliar. Evitar descartar el árbol local para corregir referencias antiguas.

**Cloudflare directo.** La publicación del Worker existente quedó confirmada en la versión `dcee2b4a-d7b4-44d6-b345-e1fd7c5e7a0f`. El nombre del Worker sigue siendo `tercer-tiempo-5bcc6746db3d` y su binding `BUCKET` apunta al R2 privado `rm26-ligas-5bcc6746db3d`. El sitio es público para acceder y crear cuenta. Las ligas requieren sesión y membresía. Conservá el Worker y bucket existentes para mantener cuentas, sesiones y ligas. `IDENTITY_MODE=accounts` usa la sesión propia y descarta identidad aportada por cabeceras de Sites. La cookie de producción es `Secure`, `HttpOnly` y `SameSite=Lax`. Los límites configurados son 20 solicitudes de autenticación y 180 de API por minuto, aproximados por conexión. El bucket conserva acceso privado. No se cambiaron plan, DNS ni dominio.

Cuando Felipe autorice otro despliegue, primero verificar cuenta, build, pruebas y destino:

```sh
npm run build
npm test
npm exec --yes --package=wrangler@4.161.0 -- wrangler whoami
npm exec --yes --package=wrangler@4.161.0 -- wrangler r2 bucket list
npm exec --yes --package=wrangler@4.161.0 -- wrangler deploy --dry-run --config wrangler.jsonc
```

Si falta autenticación, usar el flujo oficial de Wrangler en la cuenta de Felipe. Evitar volcar tokens, cookies, claves o archivos de configuración personal en código, logs compartidos o documentación. Solo con autorización para publicar, ejecutar `wrangler deploy --config wrangler.jsonc` con la CLI verificada y confirmar por HTTPS el título, el recurso `/app.js` y `/api/me`. Subir a GitHub y desplegar son operaciones independientes.

**Sites anterior.** El proyecto `appgprj_6af32ed16b2c81918a7191a06dd1d8a7` es antecedente. Su identidad y almacenamiento están separados de Cloudflare directo. Las cuentas y ligas de ambos entornos no se transfieren automáticamente. La URL pública comprobada para compartir es la de Cloudflare al inicio de este documento.

## Verificación y trabajo pendiente

| Evidencia | Qué se verificó |
| --- | --- |
| Chrome con servidor local, versión del rediseño | Portal de cuatro columnas a 1280 × 800, plantel, perfil, tácticas, mercado, navegación móvil y perfil/cantera a 390 px. El replay arrancó en 0–0 y 00:00 con 30 jugadores. El salto confirmado reveló el resultado y aparecieron los líderes y las tablas de temporada y carrera. |
| Prueba funcional de la entrada actual | Motor, dominio y JavaScript reales con DOM, API e IndexedDB simulados. Cubrió error de login, elección de modo, invitación, creación y reapertura de liga, guardado offline, recarga y cambio de modo. |
| HTTPS de producción | Se confirmó el título Rugby Manager 27, el JavaScript de entrada, Contacto, la eliminación del logo de cabecera y la respuesta pública de `/api/me` indicando `signedIn:false` y `storage:"online"`. |
| Pruebas automatizadas | Build y 66 pruebas aprobadas del commit publicado. Incluyen simulación, temporadas, estadísticas, integración M17, persistencia, permisos, API y empaquetado. |

1. Probar en producción con dos cuentas autorizadas y dos navegadores el recorrido de crear liga, invitar, unirse, marcar listo, reproducir y recargar, verificando que cada uno conserva club y progreso. Probar conflicto de versión y reconexión con latencia real.
2. Revisar visualmente la entrada nueva en producción y en teléfono. La revisión Chrome anterior corresponde al rediseño del juego. El flujo de entrada actual se validó con simulaciones de la interfaz y comprobaciones HTTP.
3. Confirmar en una copia de partida antigua el salto a datos v20, el historial al cambiar de temporada y la conservación de identidad tras un regreso. En casos históricos incompletos preservar la ausencia de datos.
4. Mejorar cobertura de planteles y seguir calibrando. `research/history/engine-weights-report.md` documenta la corrida de 1.000 temporadas del 12/11, el ajuste de fuerza en 36 clubes y la reducción del efecto de Rush. Newman–CASI quedó alrededor de 70 % de victoria local y +10,3 de margen simulado, frente a un margen empírico estimado de +5 a +6. Contrastar más temporadas y categorías antes de cambiar pesos. Para carrera larga consultar `research/playtest/career-report.md` y `research/playtest/rules-audit.md`.
5. El Interior sigue siendo ampliación futura. Las ligas paralelas todavía necesitan contraste específico con resultados de sus categorías. Mantener los datos reales, estimados y simulados diferenciados en cualquier ampliación.

## Copias anteriores

El [HTML de demostración](https://chatgpt.com/library?file_id=libfile_32fcdab15e8881919a4be31a97aba201&account_id=personal) y el [ZIP de código](https://chatgpt.com/library?file_id=libfile_11488f6a2f30819183dd98f7bdd0ac57&account_id=personal) son copias históricas v17 según el registro previo. Son anteriores a la convocatoria M17, a la calibración v20 y a la entrada actual. Para trabajar con Claude, usar este documento y el commit de GitHub indicado al principio. `docs/PROGRESO_RM26_DETALLADO.md` conserva información histórica de la etapa anterior.

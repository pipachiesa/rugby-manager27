# Tercer Tiempo · RM26

Prototipo web de manager de rugby argentino. La partida de prueba corre en el navegador; las ligas privadas requieren un servidor con identidad y almacenamiento persistente. El código de invitación no otorga por sí solo acceso a un sitio privado.

## Ejecutar

Se requiere Node 26. No hay paquetes que instalar:

```sh
npm run build
npm test
npm run dev
```

El servidor de desarrollo escucha solo en `http://127.0.0.1:4173`, usa una identidad de prueba y guarda en `.local-data/`. No permite jugar a distancia. El Worker de producción usa Sites y el binding R2 `BUCKET`; la pertenencia, las acciones de club y la escritura concurrente se controlan en el servidor. No debe instalarse detrás de un proxy que permita falsificar las cabeceras de identidad.

## Juego y datos

El punto de partida es un corte retrospectivo al 10/11/2026, con clubes y fixture 2026 de Top 14, Primera A y Primera B. Hay un plantel superior compartido y equipos M19 y M17. Intermedia, Pre A, Pre B y juveniles disputan torneos paralelos simplificados; sus resultados de equipo usan un modelo propio sin repetición ni estadísticas individuales de jugadores. La fase regular de Primera usa el motor de partidos y playoffs; se simulan semifinales, finales y promociones. El Interior figura como referencia y no es una liga jugable.

Los 26 atributos, valoraciones, resultados, fichajes y proyecciones son estimaciones de juego. El potencial es una proyección flexible, no un límite garantizado: el desarrollo depende de edad, entrenamiento, contexto y evidencia de partidos. Cada temporada ingresan 15 juveniles M17 nuevos. La convocatoria documentada URBA M17 2026 agrega 28 jugadores reales de 12 clubes (cuatro de Regatas), con edad desconocida salvo documento de nacimiento verificado. En partidas 2026/27 se incorporan sin borrar el progreso; en carreras 2028 o posteriores no se inventa su trayectoria. Algunos jugadores destacados pueden salir al exterior; sus identidades e historial se conservan y, con el tiempo, pueden regresar a su club de origen mediante una decisión simulada. Las estadísticas individuales registran lo que el motor realmente informa; si el registro anterior es incompleto, los valores desconocidos no se convierten en ceros. El perfil evita mostrar la fecha pendiente antes de terminar la repetición.

`research/catalog.json`, `age-verification.json`, `returns.json`, `youth.json`, `names.json` y los informes de `research/history/` conservan fuentes y limitaciones. Una formación histórica no demuestra una afiliación actual. Un nacimiento verificado se distingue de una edad estimada; los datos faltantes se indican. Las camisetas son ilustraciones aproximadas. Las ligas anteriores se migran sin borrar resultados, identidad, alineación ni progreso; la migración reconstruye solo la información que siga disponible.

## Alcance y comprobaciones

Los resultados de categorías paralelas, la evolución de jugadores y las probabilidades de fichaje son simulaciones, no predicciones ni datos reales. La visualización 2D reconstruye eventos generados; no es una transmisión. La partida de prueba se reinicia al recargar. La versión pública y el acceso a amigos requieren un despliegue y permisos de sitio que se deben confirmar por separado.

Los scripts de prueba cubren reglas de carrera, formación, datos, estadísticas, temporada, API y persistencia. Las pruebas automatizadas no sustituyen una revisión visual en un navegador real. Ver `PROGRESO_RUGBY_MANAGER.md` y `research/history/engine-weights-report.md` para el estado y las limitaciones de calibración.

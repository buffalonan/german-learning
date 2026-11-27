# Sag's auf Deutsch (german-learning)

Referencia técnica del código (estructura de `index.html`, scripts, reglas de código, CI): @docs/code-guide.md

## Qué es

Juegos web para que dos adultos (uno es Ferran, dueño del repo) repasen alemán cotidiano. Ambos tuvieron un B1 y están oxidados; el objetivo es comunicarse en el día a día y preparar el Goethe A2/B1. Prioridad: vocabulario, frases útiles y comprensión oral. Traducciones en inglés y español.
Juegan juntos en un portátil (compitiendo por responder primero) o en dos móviles enlazados por código de sala. Cuatro pestañas: Wortkarten (tarjetas con dibujo), Grammatik, Hören, Prüfung.

## Dónde vive

- **Repo:** https://github.com/buffalonan/german-learning (público, rama `main`). Nunca se empuja a `main`: rama + PR.
- **Web:** https://buffalonan.github.io/german-learning/ (GitHub Pages, `pages.yml` despliega en cada merge a `main` que toca el juego, ilustraciones o logo).
- **App Android:** APK en GitHub Releases (`app-v1.<run>`, archivo `sags-auf-deutsch.apk`), instalada a mano en el móvil (sin Play Store). La publica `android.yml` en cada merge.
- **Obsoletas (desde 2026-11-27 solo se usan la web y el APK):** la copia del Mac en `~/Documents/german-learning` (servida en el puerto 8081; el 8080 es otro proyecto, "recetas": no tocar) y un artifact privado de Claude. No hay que actualizarlas.
- **Archivos del proyecto (Claude):** `/mnt/project-files/illustrations/` tiene los prompts (`*-batch.md`, `prompts.md`, `logo/hedgehog-poses.md`) y los originales aprobados (`approved/<tema>-<Palabra>.jpg`, `logo/`). En el Mac, las pinturas salen de Gemini a `~/Downloads/german-pictures/<lote>/<Palabra>.jpg`.
- **Secretos (solo nombres, nunca valores):** secretos del repo en GitHub Actions: `CLAUDE_CODE_OAUTH_TOKEN` (revisor Claude, lo creó Ferran con `claude setup-token`), `ANDROID_KEYSTORE_BASE64` y `ANDROID_KEYSTORE_PASSWORD` (firma del APK, alias `sagsdeutsch`; sin ellos CI firma con una clave de un solo uso). Claude no debe leerlos ni generarlos.
- **Servicios externos:** PeerJS cloud (0.peerjs.com) para Zwei Handys; Abacus (`abacus.jasoncameron.dev`, contador `buffalonan-german-learning/besucher`) para el contador de visitas, solo en Pages; voces Piper (Kerstin, Thorsten) grabadas en CI y guardadas en la caché de Actions (caduca a los 7 días sin uso; se rellena sola en unas cuantas ejecuciones).
- **Backups:** no hay más copia que GitHub (repo y releases) y los originales en `/mnt/project-files/illustrations/approved/`. No hay tareas programadas propias; solo CI semanal de seguridad y Dependabot.

## Cómo funciona

- Sin framework ni build: todo el juego está en `index.html` (CSS, HTML y un script). Detalles en `docs/code-guide.md`; mantenlo al día cuando cambie el código.
- Comandos: `npm ci`, `npx playwright install chromium` (una vez), `npm test` (Playwright, escritorio y Pixel 7), `npx eslint . --max-warnings 0`, `npm run app:sync` (copia el juego al proyecto Android).
- Generados, no editar a mano: `pictures.js` (`node scripts/build-pictures.js`), `art.js` (`python3 scripts/add-art.py <tema> <fotos…>`), iconos del logo (`scripts/build-logo.py`), `www/`, `_site/`, `audio/`.
- Reglas que rompen CI o revisión si se saltan: HTML solo con la plantilla `html` (ESLint `no-unsanitized`); alemán correcto (artículo, plural, ortografía) con inglés y español; todo cambio de comportamiento con test Playwright; nunca saltar ni borrar tests; móvil sin scroll horizontal; modo claro y oscuro con variables de `:root`; cada tarjeta necesita su pintura (un test lo comprueba).
- CI en cada PR: ESLint, Playwright, `npm audit`, `npm audit signatures`, gitleaks, CodeQL, dependency review, Android (lint, emulador, APK). La regla "Main" exige 5 checks; las ramas se borran solas al hacer merge. Claude no puede cambiar ajustes ni reglas del repo, ni borrar ramas: lo hace Ferran.
- Revisor automático: `claude-review.yml` revisa cada PR una vez al abrirlo, con `AGENTS.md`, `docs/code-guide.md` y `REVIEW.md` de la rama base. **Los agentes nunca escriben "@claude" en comentarios de GitHub**: las sesiones publican como Ferran y eso lanza el bot de pago. Solo Ferran puede pedir otra revisión con un comentario que empiece por la orden de revisión del workflow.
- Contenedor en la nube: el Playwright del repo es más nuevo que `/opt/pw-browsers`; para probar en local, enlaza `chromium_headless_shell-1243` como `-1248` o usa `executablePath: /opt/pw-browsers/chromium`. `android.spec.js` "app copy loads Capacitor" falla en local incluso en `main`. No hay SDK de Android en la nube: Gradle solo se verifica en CI.
- Ilustraciones: estilo acuarela tipo Ghibli. Las genera una sesión Remote Control en el Mac que maneja Gemini con Claude in Chrome: modelo más ligero ("4 Hydrogen"), herramienta "Crear imagen", 1:1, una sola imagen de referencia, 6-7 imágenes por chat, decir "una imagen cada vez", sin A/B. Unas 40-60 imágenes por ventana de 5 h, más un límite semanal (Gemini > engranaje > Usage limits). Tras muchas imágenes en un chat, la descarga repite una anterior: comprobar cada archivo y abrir chat nuevo.
- El Mac no tiene credenciales de GitHub: se empuja siempre desde la nube (el Mac entrega archivos o un git bundle). Las sesiones en la nube no tienen Chrome.

## Estado actual

- Funciona (27-11-2026): 849 tarjetas en 23 temas, todas pintadas; 8 lecciones de Grammatik con 100+ frases cada una; Hören con 113 textos en 6 tipos; Prüfung con Termin finden, Gemeinsam planen, Lesen y Schreiben; Zwei Handys; rondas que se reanudan; "Meine Fehler"; voces grabadas y voz del dispositivo; modo claro/oscuro; app Android.
- El contador de visitas se ve en la web (confirmado por Ferran el 2026-11-27).
- Sin probar: la conexión real de Zwei Handys con dos móviles (CI no tiene internet; solo se prueba con un PeerJS falso). Ferran aún no la ha probado (2026-11-27).
- El APK se firma con una clave de un solo uso: los secretos `ANDROID_KEYSTORE_*` no están puestos (2026-11-27), así que cada actualización obliga a desinstalar la app.
- El test del emulador Android falla a veces por tiempo; relanzarlo suele bastar.

## Decisiones

- 2026-10-24: web primero, luego app Android del mismo juego, para empezar rápido sin tiendas.
- 2026-10-24: repo público con pipeline de PR (tests, auditoría de dependencias, secretos), para poder confiar en los cambios de agentes.
- 2026-10-25: modo por defecto "Üben" (práctica) en todas las secciones; Ferran lo prefiere al competitivo.
- 2026-10-25: estilo "claymorphism" (skill ui-ux-pro-max, índigo + verde, Nunito + DM Sans, iconos de línea, no emoji), porque los dos estilos anteriores no gustaron.
- 2026-10-25: ilustraciones propias tipo Ghibli en vez de emoji 3D, que parecían baratos. Se guardan por tema + palabra (no por emoji, porque 🪑 se repite).
- 2026-10-25: voces grabadas con Piper, lentas (`LENGTH_SCALE` 1.4) y sin ruido, porque la primera toma iba rápida y susurrada; la voz por defecto es la del dispositivo ("German Germany" en Android, Google Deutsch en Chrome), elegida por Ferran.
- 2026-10-26: Ferran no quiere pasos manuales en el Mac ni avisos de permiso repetidos. Si una sesión pierde el Mac, abrir otra con acceso a carpetas (Downloads y Documents ya aprobadas).
- 2026-10-26: colores = una pincelada sobre papel blanco; números = cifras pintadas a pincel en índigo.
- 2026-10-26: "die Jeans" es singular `die`, no plural.
- 2026-11-03: en UX importan más los flujos de uso diario (menos toques, retomar donde se dejó) que los colores.
- 2026-11-03: "Otra vez" en práctica devuelve la tarjeta tres cartas después (antes se volvía a girar en el acto).
- 2026-11-03: Zwei Handys con código de sala vía PeerJS, en vez de códigos QR.
- 2026-11-03: toda lección de Grammatik necesita al menos 100 frases (Ferran vio pocas); las frases no se repiten entre lecciones.
- 2026-11-05: el erizo del logo aparece en cada pestaña con su propia pose.
- 2026-11-25: se evita "morgen" (mañana) porque su nombre de archivo choca con "Morgen".
- 2026-11-27: quitar la voz Kerstin, porque pronuncia mal (Ferran). Ya no suena susurrada.
- 2026-11-27: solo se mantienen la web de GitHub Pages y el APK; la copia del Mac y el artifact quedan obsoletos (Ferran solo usa esas dos).
- 2026-11-27: un solo archivo de contexto (`AGENTS.md`, en español); los detalles del código pasan a `docs/code-guide.md`.

## Pendiente

- Siguiente paso de la hoja de ruta: Ferran no ha elegido aún. Ideas apuntadas sin decidir: temporizador para hablar, B1 Präsentation (Sprechen Teil 2), más textos de Lesen y Schreiben, construir frases con weil/dass.
- Probar Zwei Handys con dos móviles (Ferran) y arreglar lo que falle.
- Poner los secretos de firma del APK: Ferran crea la clave en su Mac con los comandos del README (Claude no puede generarla).
- Quitar la voz grabada Kerstin (decidido el 2026-11-27, en marcha). Falta decidir quién lee la segunda voz de los diálogos de Hören, que hoy alterna Kerstin y Thorsten.
- Los meses comparten una pintura (bloques + muñeco de nieve de Januar); se podrían repintar uno a uno si Ferran lo pide.

## Historial

- 2026-10-24: primer juego de tarjetas; repo creado y hecho público; pipeline de CI.
- 2026-10-25: revisor Claude en PRs; app Android con Capacitor y voz nativa; GitHub Pages; voces Piper; estilo clay; primeras ilustraciones (verbos, comida, casa).
- 2026-10-26: todos los temas pintados (224 tarjetas), números; +116 palabras (364 tarjetas); logo del erizo.
- 2026-11-01/02: Perfekt ampliado; +149 tarjetas y 6 temas nuevos (familia, tiempo, salud, compras, sentimientos, ocio), todas pintadas (PR #54, #56).
- 2026-11-03: pestaña Prüfung, 4 lecciones B1, temas Goethe, Hören hasta 113 textos, 100+ frases por lección (PR #57, #59, #60).
- 2026-11-04: inicio rápido, Atrás, rondas reanudables, Meine Fehler, Zwei Handys (PR #61); iconos pintados de las fichas (PR #63).
- 2026-11-05: pinturas de las 86 tarjetas Goethe (PR #64); contador de visitas (PR #65); poses del erizo (PR #66).
- 2026-11-26: +100 palabras cotidianas y sus pinturas (699 tarjetas, PR #70, #71); voces grabadas por tandas con tiempo límite.
- 2026-11-27: +150 palabras útiles con pinturas (849 tarjetas, PR #72). AGENTS.md reescrito en español.

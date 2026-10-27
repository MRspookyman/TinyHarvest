# 🌱 Tiny Harvest — Plan de diseño

> Documento vivo. Lo vamos actualizando en cada iteración.
> **Estado:** borrador v0.8 · **Última actualización:** 2026-10-27
> **Roles:** Claude programa · el autor revisa y guía.

---

## 0. Concepto

- **Nombre provisional:** Huerto Diminuto / *Tiny Harvest*
- **Género:** incremental **activo** de granja con trabajadores automáticos y gestión ligera.
- **Idea:** empiezas recogiendo a mano en una parcela pequeña. Con las monedas contratas **gnomos** que recogen, plantan y transportan por ti. El huerto crece, aparecen cultivos nuevos y los gnomos se especializan. Al final "reinicias" el huerto a cambio de semillas doradas permanentes.
- **Gancho:** a diferencia de muchos incrementales, que son solo números, aquí **ves a cada gnomo trabajar** (como un hormiguero) y **organizas cómo trabajan**. El progreso no viene solo de comprar más, sino de organizarlos mejor.
- **Tono:** gnomos clásicos (gorro rojo, barba, botas) con humor: torpes, orgullosos, quejicas y entrañables.

---

## 1. Lenguaje y tecnología

### 1.1 Programación ✅

**TypeScript + PixiJS + Vite**, con guardado en `localStorage`.

| Opción | Pros | Contras |
|---|---|---|
| **TypeScript + PixiJS** ⭐ | Navegador, se comparte con un enlace, itch.io, cientos de sprites sin problema | Estructura a mano |
| Godot (GDScript) | Editor visual, multiplataforma | Más pesado para la web |
| Unity (C#) | Muy potente | Excesivo para el género |

**Plataformas:** primero solo navegador (escritorio). Para no cerrar la puerta a otras plataformas:
- Lógica del juego separada del render (simulación pura en TS, testeable).
- Interfaz pensada para ratón, pero sin depender del hover (para poder llevarla a táctil).
- Más adelante: **Tauri/Electron** para PC (Steam) y **Capacitor** para móvil, reutilizando el mismo código.

### 1.2 Idioma y tono del juego ✅

- Idioma: **solo español**. Los textos irán juntos en un único fichero para retocarlos fácilmente, sin sistema de traducción.
- Tono: humor blanco y absurdo.
  - Nombres de gnomos: "Pepín Barbatiesa", "Tomasito el Breve", "Don Remolacho"…
  - Descripciones de rasgos con chiste: *"Perezoso: −10 % velocidad. Dice que está 'pensando'."*
  - Mensajes de estado: *"Gilberto se ha sentado en una calabaza. Otra vez."*
  - Mejoras con nombres ridículos: *"Botas con suela de corcho"*, *"Café de bellota"*, *"Seminario motivacional"*.

---

## 2. Vista

- **Cenital 2D en pixel art**: cuadrícula de parcelas vista desde arriba.
- Alternativa descartada por ahora: isométrica (cara de dibujar).

**Distribución de pantalla:**
- **Centro:** el huerto con los gnomos moviéndose (zoom y desplazamiento).
- **Barra superior:** recursos (monedas 🪙, cultivos, semillas doradas ✨).
- **Panel lateral con pestañas:** Contratar · Gnomos · Mejoras · Cultivos · Edificios.
- **Ficha de gnomo:** al hacer clic en un gnomo se ve su nombre, oficio, rasgos, grupo y una frase graciosa.

---

## 3. Estilo visual

- Pixel art **16×16 o 32×32**, colores cálidos y saturados, tono *cozy*.
- **Gnomos:** cuerpo redondito, gorro cónico con el color del oficio, barba, 2–4 frames (andar, recoger, cargar, quejarse).
- **Humor visual:** gnomos que tropiezan, se duermen, discuten entre ellos o se sientan sobre la cosecha. Bocadillos con iconos (💤 😤 ❗).
- **Respuesta visual:** cultivos que saltan, números flotantes (+5 🪙), partículas de hojas.
- **Paleta:** tipo *Resurrect 64* o *Sweetie 16*.

**Assets (de momento) ✅:** sprites dibujados por código o un pack gratuito (p. ej. Kenney, CC0). Para la demo empiezo con sprites por código y cambiamos si encontramos un pack que encaje. El arte propio queda para más adelante.

**Estilo cerrado ✅** (referencia: [estilo/gnomo.html](estilo/gnomo.html))
- **Gnomos a 16×16**, ampliados ×3–4 en pantalla, con contorno oscuro `#1a1c2c`. El gorro les tapa los ojos, tienen una nariz enorme, barba blanca, túnica verde azulada y botas de 2 px. Andan a saltitos.
- **Color del gorro por oficio:** rojo (recolector), lima (sembrador), marrón (porteador), azul (regador), dorado (capataz), gris (guardián).
- **Animaciones:** quieto, andar (4 fotogramas), recoger (agacharse), cargar saco, protestar (bocadillo "!!") y siesta (Zz).
- **Huerto:** un **bancal rectangular continuo**, con surcos de lado a lado, borde de tierra oscura y hierba que invade los bordes. Crece añadiendo filas o columnas.
- **Plantas:** con contorno verde oscuro y 4 fases (semilla, brote, joven, madura). El tomate crece con un palo de tutor. **Pendiente: hacerlas más detalladas** (más fases y más detalle en la planta madura).
- **Profundidad:** plantas y gnomos se ordenan por fila, así que un gnomo puede quedar delante o detrás de una planta.

---

## 4. Ciclo del juego

**Ciclo corto (segundos):**
> Plantar → crecer → recoger (clic o gnomo) → vender → monedas

**Ciclo medio (minutos), el núcleo activo:**
> Contratar gnomos → **organizarlos** en grupos con prioridades → detectar cuellos de botella → mejorar → desbloquear cultivos y parcelas

**Ciclo largo (1–2 h por temporada), el prestigio:**
> "Fin de temporada": reinicias el huerto y ganas **semillas doradas** según lo producido. Se gastan en un árbol de talentos permanente.
> La primera temporada debería durar **1–2 horas** de juego activo.

**Sin progreso offline ✅:** con el juego cerrado no se avanza nada. Al volver, la partida continúa justo donde quedó. Si la pestaña pasa a segundo plano, la simulación se pausa (sin recuperar el tiempo perdido) y se reanuda al volver.

---

## 5. Gestión de los gnomos

Lo que distingue el juego. **Gestión básica de grupos y prioridades** ✅, nada de microgestión uno a uno.

| Capa | Mecánica | Cuándo |
|---|---|---|
| 1 | **Oficios:** cada gnomo hace un trabajo fijo | Desde el principio |
| 2 | **Grupos:** repartes a los gnomos en grupos (p. ej. "Los de la zanahoria", "Cuadrilla B") | Fase 2 |
| 3 | **Prioridades por grupo:** cada grupo tiene una regla sencilla (ver abajo) | Fase 2 |
| 4 | **Capataz:** potencia a su grupo | Fase 3 |

**Prioridades iniciales (lista corta):**
- *Lo más cercano primero* (rápido, poco desplazamiento).
- *Lo más valioso primero* (más monedas, más paseo).
- *Solo un cultivo concreto* (p. ej. "solo calabazas").

**Principio de diseño:** los problemas tienen que **verse**. Si el granero se llena, los gnomos esperan con sacos y protestan; si un grupo no tiene sembradores, sus parcelas se quedan vacías. Primero se ve el problema y después se mira el número.

**Ideas para más adelante (fuera del alcance actual):** zonas pintadas en el mapa, ánimo y descanso, sinergias y piques entre gnomos.

---

## 6. Progresión

### 6.1 Oficios

| Oficio | Gorro | Función |
|---|---|---|
| 🧺 Recolector | Rojo | Recoge los cultivos maduros |
| 🌰 Sembrador | Verde | Vuelve a plantar las parcelas vacías |
| 🛒 Porteador | Marrón | Lleva la cosecha al granero |
| 💧 Regador | Azul | Acelera el crecimiento |
| 👑 Capataz | Dorado | Mejora a su grupo (y les grita, con cariño) |
| 🛡️ Guardián | Gris | Espanta cuervos y plagas |

### 6.2 Cultivos (tiempo de crecimiento ↔ valor)

Zanahoria → Trigo → Tomate → Calabaza → Fresa → Melón → exóticos (setas brillantes, flor lunar…)

### 6.3 Fases

1. **Fase 1:** clicar a mano, primeros recolectores.
2. **Fase 2:** sembradores y porteadores, grupos con prioridades y primeros cuellos de botella.
3. **Fase 3:** edificios (molino, mercado, casa de gnomos), capataces y venta automática.
4. **Fase 4:** prestigio, biomas nuevos (pantano, montaña, huerto nocturno) y eventos.

### 6.4 Matemática base

- Coste de contratar: `coste = base × 1.15^n`
- Producción lineal con multiplicadores, más un **multiplicador de organización** (eficiencia de la cadena) para premiar la buena gestión.
- Ajustar los números para que la primera temporada dure 1–2 h.

---

## 7. Ideas para que destaque

- **Coleccionar gnomos:** rasgos aleatorios con chiste y algún gnomo raro (legendario) de vez en cuando.
- **Eventos humorísticos:** cuervos, el "sindicato gnomo" pide más café, un gnomo se cree espantapájaros, lluvia de ranas…
- **Diario del huerto:** registro con las frases graciosas de lo que ha pasado.

---

## 8. 🎯 Demo (primer prototipo)

**Objetivo:** comprobar si mirar a los gnomos trabajar y organizarlos engancha. Muy básica y limitada a propósito.

### Incluye

- **Huerto:** cuadrícula fija de 5×5 parcelas y un granero en un lado.
- **Cultivos:** 2, **zanahoria** (rápida y barata) y **tomate** (lenta y valiosa).
- **Acciones manuales:** clic en una parcela vacía para plantar y clic en un cultivo maduro para recogerlo.
- **Venta:** lo que llega al granero se vende automáticamente.
- **Gnomos:** 2 oficios, **recolector** (recoge y lleva al granero) y **sembrador**. Coste creciente (`× 1.15^n`).
- **Grupos:** hasta 2 grupos, cada uno con una prioridad (*cercano* / *valioso* / *solo X*).
- **Mejoras:** 3–4 sencillas (velocidad al andar, capacidad del saco, crecimiento más rápido).
- **Personalidad mínima:** nombre aleatorio gracioso y un bocadillo de vez en cuando.
- **Visual:** sprites por código, números flotantes y animación simple de andar.
- **Guardado:** `localStorage` al cerrar y cada X segundos, sin progreso offline.

### No incluye (todavía)

Prestigio, edificios, porteador, regador, capataz, guardián, eventos, rasgos con efectos, zoom y cámara, sonido.

### Criterios para darla por buena

- [ ] En 5–10 minutos se pasa de clicar a mano a tener un huerto automático.
- [ ] Cambiar la prioridad de un grupo tiene un efecto **visible** en cómo se mueven los gnomos.
- [ ] Es entretenido dejarlo un minuto y solo mirar.

---

### Estado de la demo (2026-10-27)

Primera versión jugable hecha. Probada en Chrome: los gnomos recogen, entregan en el granero, replantan, y el diario y los grupos funcionan.

**Cómo ejecutarla**
```bash
npm install      # solo la primera vez
npm run dev      # abre la URL que muestra Vite
npm test         # tests de la simulación
npm run build    # genera dist/ para subir a itch.io
```
**Atajos de revisión (solo en `npm run dev`):** `?monedas=500&recolectores=3&sembradores=1` empieza una partida limpia con esos gnomos y monedas.

**Estructura**
- `src/sim/`: simulación pura (estado, reglas, IA de los gnomos, guardado), con tests.
- `src/render/`: sprites por código, fondo y escena PixiJS. Solo leen el estado.
- `src/ui/panel.ts`: barra superior, pestañas, grupos y diario en HTML.
- `src/textos.ts`: todos los textos del juego.

### Opinión tras jugar la demo v1

- **Ritmo:** demasiado rápido; se compra todo enseguida.
- **Grupos:** no se nota la diferencia entre prioridades.
- **Lo mejor:** mirar a los gnomos, comprar mejoras y organizar grupos.
- **Pedido para la siguiente iteración:** marcar los grupos en el huerto, ampliar el bancal con cámara que se adapte, porteador y cultivos nuevos.

### Iteración 2 (hecha)

Atajos de revisión ampliados: `?monedas=400&recolectores=4&sembradores=2&porteadores=1&bancal=5`.

| Cambio | Detalle |
|---|---|
| **Grupos visibles** | Aro de color bajo cada gnomo (A azul, B rosa) y una marca del mismo color en la parcela a la que va. Los colores se repiten en el panel. |
| **Bancal ampliable** | Empieza en 3×3 y llega a 9×6, una columna o una fila cada vez. Coste: `25 × 1,55^n`. |
| **Cámara** | Se ajusta al huerto: muy cerca al principio y se aleja según crece, siempre con escala entera para que el pixel art no se deforme. |
| **Porteador** (gorro marrón) | Con porteadores, los recolectores dejan la cosecha en una **cesta** junto al bancal (máximo 30) y los porteadores la llevan al granero, 5 por viaje. Si la cesta se llena, los recolectores esperan con el saco: un cuello de botella que se ve. |
| **Cultivos** | Zanahoria (2 monedas, 10 s) → Trigo (5, 16 s, se desbloquea por 60) → Tomate (12, 28 s, por 250) → Calabaza (40, 60 s, por 1.200). |
| **Ritmo más lento** | Recolector 12, sembrador 18, porteador 45, ×1,18 por cada gnomo del mismo oficio. Mejoras más caras y con más niveles (hasta 4–5). |

La partida guardada de la v1 no es compatible con esta versión: se empieza de cero.

### Iteración 3: menús dentro del mundo (hecha y probada)

| Cambio | Detalle |
|---|---|
| **Acceso desde el huerto** | Clic en el **granero** → Contratar. Clic en el **tablón de anuncios** → Grupos. Clic en el **árbol viejo** → Árbol de mejoras. Al pasar el ratón por encima, el elemento se resalta con un contorno y aparece su nombre. Abajo hay una barra pixel art con los mismos accesos, el diario y la semilla elegida para plantar a mano. |
| **Ventanas pixel art** | Marco de madera sobre pergamino, encima del huerto, que sigue moviéndose detrás. Se cierran con la X o con Esc. Desaparece el panel lateral. |
| **Árbol de mejoras** | Sustituye a las mejoras sueltas. Crece hacia arriba desde la raíz «Huerto» en tres ramas. **Gnomos:** botas → café / saco → porteadores → cesta grande. **Bancal:** ampliar (9 niveles). **Cultivos:** trigo → abono / tomate → calabaza. Cada nodo necesita a su padre; los porteadores y los cultivos nuevos se desbloquean aquí. |
| **Grupos libres** | Se pueden crear todos los que se quiera (hasta 20) y borrarlos. Cada grupo tiene **nombre editable**, **color** elegido de la paleta del juego (12 colores) y prioridad. Los gnomos se mueven entre grupos arrastrándolos o con «Mover aquí». Los nuevos van al primer grupo. |
| **Prestigio** | El árbol con semillas doradas sigue pendiente para más adelante. |

**Prueba (2026-10-27):** `tsc`, los 21 tests y `npm run build` pasan. En Chrome, con una ventana de 1280×800 y otra de 1024×600, se han comprobado estas cosas:
- Los menús se abren desde el granero (el contorno y el nombre aparecen al pasar el ratón) y desde la barra, y se cierran con Esc.
- Al comprar trigo en el árbol se gastan 60 monedas y se activa la semilla de trigo en la barra.
- Se puede crear un grupo, mover un gnomo con «Mover aquí» y ver aros de dos colores en el huerto.
- Al recoger a mano se suman las monedas.
- Tras recargar se conservan las monedas, los gnomos y los grupos.

**Arreglado en la prueba:** el **diario** crecía más que la pantalla y quedaba tapado por la barra. Ahora las ventanas no pasan de la altura disponible y el contenido se desplaza (`.win-layer` en `style.css`).

### Estudio de equilibrio tras la iteración 3

Un bot jugó 3 horas de partida simulada. Compraba siempre lo más barato y replantaba con el mejor cultivo. Los tiempos son de un jugador muy eficiente; una persona real irá algo más lenta, pero no 2–4 veces más.

| Momento | Activo (1 clic/s) | Tranquilo (1 clic/5 s) |
|---|---|---|
| Huerto automático | 1,0 min | 3,8 min |
| Trigo | 8,4 min | 13,1 min |
| Tomate | 17,8 min | 24,4 min |
| 40 gnomos (tope) | 18,3 min | 25,1 min |
| Árbol completo | **23,2 min** | **31,4 min** |
| Después | ~69 monedas/s y nada que comprar | ~68 monedas/s y nada que comprar |

**Conclusiones**
1. **El contenido dura una cuarta parte de lo previsto.** La temporada debería durar 1–2 h y todo se acaba a los 25–30 min. Contratar es barato (×1,18 por gnomo), así que el tope de 40 se alcanza pronto, y luego las monedas no tienen en qué gastarse.
2. **Cada cultivo es mejor que el anterior en todo.** Da más monedas por parcela y más monedas por viaje:

   | Cultivo | Monedas/s por parcela | Monedas por viaje |
   |---|---|---|
   | Zanahoria | 0,20 | 2 |
   | Trigo | 0,31 | 5 |
   | Tomate | 0,43 | 12 |
   | Calabaza | 0,67 | 40 |

   No hay ninguna elección real: la zanahoria y las prioridades «solo X» dejan de tener sentido.
3. **Las prioridades solo cuentan cuando faltan gnomos.** Prueba en un bancal de 9×6 con los cuatro cultivos mezclados:
   - Con 2 recolectores + 2 sembradores: «cercano» da 0,52 monedas/s y «valioso» 4,21.
   - Con 6 + 4: 2,52 frente a 7,97.

   Cuando sobran gnomos (como en la v1, o con 40 gnomos para 54 parcelas) da igual la prioridad. Eso explica la opinión de que «no se nota».
4. **«Valioso» no tiene en cuenta la distancia.** El cálculo resta `valor × 1000`, así que un gnomo cruza todo el bancal por una calabaza aunque tenga una zanahoria al lado.
5. **El sembrador vuelve a plantar lo mismo que había.** Para pasar el huerto a calabaza hay que hacer clic en cada parcela justo cuando está vacía, compitiendo con tus propios sembradores.
6. **Los porteadores no reservan la cesta.** Si hay un solo cultivo, van todos a por él y los que llegan tarde vuelven sin nada.

### Iteración 4 (propuesta, por orden)

| # | Cambio | Qué resuelve |
|---|---|---|
| 1 | **Semilla por grupo:** cada grupo elige qué siembran sus sembradores («Los de la zanahoria» siembran zanahoria). | Conclusión 5. Da a los grupos un papel sobre el terreno sin microgestión. |
| 2 | **Podredumbre:** lo maduro aguanta un tiempo (corto en fresa y tomate) y después se estropea, y se ve (planta mustia). | Conclusión 3. Las prioridades cuentan siempre y el problema se ve, como pide la sección 5. |
| 3 | **Ventajas y costes por cultivo:** rápido y laborioso (más por parcela) frente a lento y cómodo (más por viaje). | Conclusión 2. |
| 4 | **Más ritmo y en qué gastar:** `COST_GROWTH` a ~1,25–1,3; tope de gnomos según la **casa de gnomos** (edificio con niveles); más nodos en el árbol; multiplicador de organización. | Conclusión 1. |
| 5 | **«Valioso» que cuente la distancia** (valor dividido entre distancia, o algo parecido). | Conclusión 4. |
| 6 | **Reserva de la cesta** para los porteadores. | Conclusión 6. |

**Más adelante:** zonas del bancal por grupo; regador (si el tomate lo necesita); calabaza de 2×2; prestigio con semillas doradas como gran gasto final; rasgos con efectos y gnomos legendarios; eventos (cuervos y guardián, «sindicato gnomo»).

---

## ❓ Preguntas abiertas

- [ ] ¿Empezamos la iteración 4 por la semilla por grupo y la podredumbre, o primero el ritmo?
- [ ] Ritmo objetivo: ¿la temporada debe durar 1–2 h ya en la demo, o vale con ~45 min hasta que exista el prestigio?

---

## ✅ Decisiones tomadas

| # | Tema | Decisión |
|---|---|---|
| 1 | Programación | TypeScript + PixiJS + Vite |
| 2 | Idioma y tono | Solo español, humor absurdo, textos en un único fichero |
| 3 | Plataforma | Primero navegador; arquitectura preparada para PC y móvil |
| 4 | Ritmo | Incremental activo: mejoras, contratación y organización de los gnomos |
| 5 | Desarrollo | Claude implementa; el autor revisa y guía |
| 6 | Personajes | Gnomos clásicos con toque humorístico |
| 7 | Offline | Sin progreso con el juego cerrado; pausa en segundo plano |
| 8 | Gestión | Básica: grupos con prioridades, sin microgestión individual |
| 9 | Temporada | La primera dura 1–2 h |
| 10 | Arte | Sprites por código o pack gratuito, de momento |
| 11 | Primer hito | Demo muy básica (sección 8) para validar la idea |
| 12 | Resolución | Gnomos 16×16 con contorno oscuro |
| 13 | Huerto | Bancal rectangular continuo con surcos |
| 14 | Plantas | Estilo con contorno; hacerlas más detalladas en la demo |

---

## 📝 Historial de cambios

- **v0.8 (2026-10-27):** iteración 3 probada en el navegador. Arreglado el diario, que se salía de la pantalla. Añadidos el estudio de equilibrio (bot de 3 h: el contenido se acaba en 23–31 min, cada cultivo supera al anterior en todo y las prioridades solo cuentan cuando faltan gnomos) y la propuesta de la iteración 4.
- **v0.7 (2026-10-27):** iteración 3. Los menús se abren desde el huerto (granero, tablón y árbol viejo) y desde una barra pixel art. Ventanas de madera y pergamino. Árbol de mejoras con ramas en lugar de mejoras sueltas. Grupos ilimitados (hasta 20) con nombre, color de la paleta y prioridad propios, y gnomos que se arrastran entre grupos. La partida de la v0.6 no es compatible.
- **v0.6 (2026-10-27):** iteración 2 a partir de la opinión tras jugar: grupos visibles (aros y marcas de color), bancal ampliable de 3×3 a 9×6 con cámara que se adapta, porteador con cesta, trigo y calabaza, y ritmo más lento.
- **v0.5 (2026-10-27):** primera demo jugable (Vite + TypeScript + PixiJS). Las plantas tienen ahora 5 fases (con tomates verdes antes de madurar) y un destello cuando están listas.
- **v0.4 (2026-10-27):** estilo visual cerrado a partir de la hoja [estilo/gnomo.html](estilo/gnomo.html): gnomos 16×16, bancal continuo y plantas con contorno (pendiente darles más detalle). Se empieza la demo.
- **v0.3 (2026-10-27):** sin progreso offline, gestión simplificada a grupos y prioridades, temporada de 1–2 h, solo español, assets por código o pack gratuito y nueva sección 8 con el alcance de la demo.
- **v0.2 (2026-10-27):** respondidas las 5 preguntas iniciales. Nueva sección "Gestión de los gnomos", tono humorístico, i18n, oficio de guardián, progreso offline limitado y nuevas preguntas abiertas.
- **v0.1 (2026-10-27):** borrador inicial con concepto, tecnología, vista, estilo, ciclo, progresión e ideas.

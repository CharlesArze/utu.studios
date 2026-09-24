# Tramo hero → wordmark final ("start with mix" / "you to you")

Extraído del chunk `/_next/static/immutable/chunks/14mi0bklv8h5w.js` de
newmixcoffee.com/en (descargado y formateado con `prettier --parser babel`
en el scratchpad de esta sesión). Es el único chunk que contiene
`brandParticles`, `ScrollTrigger` y el gesture handler — código fuente
real, no inferencia visual.

Librerías confirmadas en este chunk: **gsap** (dynamic `import` vía
`e.A(16495)`, sin string de versión legible tras el bundling) +
**gsap/ScrollTrigger** (`e.A(96349)`) + **Lenis** (clase `f` instanciada
con las opciones exactas de abajo). No hay Three.js en este chunk (vive en
el chunk del hero, fuera de este tramo).

## 1. Lenis (scroller `content`, fuera de `landing`)

```js
new Lenis({
  wrapper: scrollerEl,       // el div fixed con overflow-y:auto
  content: contentEl,        // "white-bg-content"
  smoothWheel: true,
  syncTouch: true,
  duration: 0.8,
  easing: (e) => (e === 1 ? 1 : 1.001 - Math.pow(2, -10 * e)),
});
```
Se crea/destruye junto con la fase `"content"` (no corre durante
`landing`/`brand-snap`). Cada frame de Lenis dispara `ScrollTrigger.update()`.

## 2. Gesture handler (equivalente a nuestro ScrollShell)

Estado: `currentSection: "hero" | "white"`, `whitePhase: null | "landing" |
"brand-snap" | "content"` (el estado `"brand-snap"` **solo existe en
mobile**, `innerWidth < 1024`). Un lock (`isBusy`) + cooldown de **200ms**
tras cada `animationEnd` (idéntico al que ya teníamos). Touch además
soporta "swipe rápido en cola" durante una animación en curso: si llega un
segundo swipe mientras la timeline anterior sigue corriendo, esa timeline
se acelera a `timeScale(10)` en vez de ignorarse.

### 2.1 Hero → white (`transitionToWhite`, un solo trigger)
- Se dispara con **wheel `deltaY > 30`** (no `> 0`) o click en el indicador.
- `gsap.fromTo(scrollerEl, {yPercent:100}, {yPercent:0, duration:0.8,
  ease:"power3.out", onUpdate, onComplete})`.
- `onUpdate`: `t = this.ratio` (progreso 0→1 de ESTE tween, no
  `1 - yPercent/100` como teníamos):
  - `setWhiteBgYOffset(Math.round((viewHeight - navHeight) * (1 - t)))`
  - `setColorMixTarget(t)`
  - `setMorphProgress(t)`
- `onComplete`: `setWhiteBgYOffset(0)`, `scrollTop = 0`,
  `whitePhase = "landing"`.
- El morph-target (logo) se posiciona en `top: round(0.75*viewHeight -
  navHeight)` justo ANTES de arrancar el tween (no durante).

### 2.2 Landing → content, desktop (`landingAdvance`, scrub único)
Trigger: wheel `deltaY > 0` o swipe-up (`dy < -30`) touch, solo en fase
`landing`, solo desktop (`innerWidth >= 1024`).
```js
o = gsap.timeline({ onComplete })
o.to(logoEl, { top: round(0.25*viewHeight - navHeight)+"px", duration:0.6,
  ease:"power3.out", onUpdate: () => logoTopRatio = 0.75 - 0.5*this.ratio })
o.fromTo(".brand-dash-line", clip100→0, {duration:0.5}, 0.3)
o.fromTo(".brand-image",   {opacity:0,y:30}→{opacity:1,y:0,duration:0.4}, 0.4)
o.fromTo(".brand-text",    {opacity:0,y:20}→{opacity:1,y:0,duration:0.4}, 0.5)
```
Al completar: `whitePhase = "content"`, se habilita `overflow-y:auto` +
`ScrollTrigger.refresh()`.

### 2.3 Landing → brand-snap, mobile (mismo trigger, rama distinta)
En mobile, en vez de `"content"`, `landingAdvance` termina en
`whitePhase = "brand-snap"` — un modo de **3 pasos con swipe**, no scroll
libre (ver §4). `"content"` en mobile solo se alcanza tras completar el
paso 3 del snap.

### 2.4 White → hero (`transitionToHero`, un solo trigger)
Trigger: wheel `deltaY < 0` con `scrollTop <= 0` en fase `content`
(desktop), o cualquier intento de salir de `brand-snap`/`landing` hacia
arriba. Antes del tween se hace `gsap.set(...)` de TODO el estado inicial
(dash-lines, brand-image(s), slogan, trazo `strokeDasharray:"0 9999"`,
labels, wordmark final) — un reset duro, no depende de que el usuario haya
llegado hasta el final.
```js
gsap.to(scrollerEl, { yPercent:100, duration:0.8, ease:"power3.out",
  onUpdate: () => { t = this.ratio;
    setWhiteBgYOffset(round((viewHeight-navHeight)*t));
    setColorMixTarget(1-t); },
  onComplete: () => { setWhiteBgYOffset(viewHeight-navHeight); ... } })
```
No anima `setMorphProgress` en el onUpdate (se fija a 0 de entrada con
`setMorphProgress(0)` antes del tween, no interpolado).

## 3. Timeline del pin, desktop (`ScrollTrigger scrub`)

Estructura DOM real (**dos niveles**, no uno):
```
<div class="relative z-[1] bg-black">              ← u: SOLO recibe la altura extra, es el trigger
  <div class="sticky top-0 h-screen ..." >         ← p: se queda pegado, SIN alto propio inline
    <div class="brand-story-bg ..." style="height:300%">  ← d: fondo, con brandParticles dentro
    <div class="brand-story-content ...">          ← f: contenido, el que se traslada en Y
      ...
    </div>
  </div>
</div>
```
`u.style.height = innerHeight + T + "px"` (T = altura del contenido +90).
`p` (el pin) NO recibe `style.height` — se queda en `h-screen` fijo por
CSS. El `ScrollTrigger` usa `trigger: u`, no `trigger: p`.

**Esto es distinto de lo que había en el código antes**: la versión previa
ponía la altura extra directamente sobre el propio div `sticky`
(`pinRef`), fusionando "envoltorio con la altura de scroll" y "panel que
se pega" en un solo elemento — de ahí venían los parches de `Math.min`
para `slideUp`/`target` y el contenido cortado (el `sticky` no tenía
verdadero espacio de sobra dentro de su propio padre para "pegarse").

Timeline (posiciones GSAP **relativas** por defecto — cada tween sin
posición explícita empieza donde termina el anterior; `"<"` = mismo inicio
que el tween anterior):

```js
t = gsap.timeline({ scrollTrigger: { trigger: u, scroller, start:"top top",
  end:"bottom bottom", scrub:true,
  onUpdate: e => brandParticles.setScrollParallax(e.progress, R),
  onLeave: () => brandParticles.stop(), onEnterBack: () => brandParticles.start() } })

t.to(f, {y: j, duration:0.25, ease:"none"})                              // t=0    → 0.25
t.fromTo(g/* dash-line-2 */, clip100→0, {duration:0.2}, "<")             // t=0    → 0.20
t.fromTo(brandSlogan, {opacity:0,y:20}→{opacity:1,y:0,duration:0.15}, "-=0.1")  // t=0.10 → 0.25
t.fromTo(brandImage2, {opacity:0,y:30}→{opacity:1,y:0,duration:0.15})    // t=0.25 → 0.40  (secuencial, SIN posición)

t.to(".line-start-dot", {opacity:1, duration:0.03})                      // t=0.40 → 0.43
t.to(drawProgress, {progress:1, duration:0.35, ease:"none", onUpdate:draw})  // t=0.43 → 0.78
t.to(f, {y: target, duration:0.35, ease:"none"}, "<")                    // t=0.43 → 0.78  (paralelo al trazo)
t.to(".line-end-arrow", {opacity:1, duration:0.03})                      // t=0.78 → 0.81
// 5 etiquetas, cada una empieza 0.01 ANTES de que termine la anterior:
t.fromTo(".line-label-1", {opacity:0,y:8}→{opacity:1,y:0,duration:0.04})       // 0.81 → 0.85
t.fromTo(".line-label-2", ..., "-=0.01")                                        // 0.84 → 0.88
t.fromTo(".line-label-3", ..., "-=0.01")                                        // 0.87 → 0.91
t.fromTo(".line-label-4", ..., "-=0.01")                                        // 0.90 → 0.94
t.fromTo(".line-label-5", ..., "-=0.01")                                        // 0.93 → 0.97
t.fromTo(brandLineSlogan/*wordmark final*/, {opacity:0,y:12}→{opacity:1,y:0,duration:0.06,ease:"power2.out"})  // 0.97 → 1.03

// solo si el alcance final (finalReach) es MENOR que el target ya usado arriba:
if (finalReach < target) t.to(f, {y: finalReach, duration:0.15, ease:"none"})  // 1.03 → 1.18

z = t.duration()                       // ~1.18 (o ~1.03 si el `if` no aplicó)
t.to({}, {duration: (90/(T-90)) * z})  // relleno: mantiene el pin activo 90px de scroll extra al final
fullDuration = t.duration()
t.fromTo(d/*brand-story-bg*/, {y:0}, {y:R, duration: fullDuration, ease:"none"}, 0)  // TODO el timeline, empieza en 0 absoluto
```

Donde:
- `j = brandSlogan ? -(brandSlogan.offsetTop - topOffset) : -749`,
  `topOffset = innerWidth > 1024 ? 200 : 100`.
- `w` = `lineWrap.offsetTop + lineWrap.offsetHeight` (con el padding-bottom
  dinámico que empuja el viewport si el timeline terminaría por encima de
  `viewportH`, igual que ya teníamos).
- `target = min(max(-(brandImage2.centroY), finalReach), j)`.
- `finalReach = -(w - viewportH)`.
- `R = -(bg.offsetHeight - bg.parentElement.offsetHeight)` (recorrido del
  fondo, que en la referencia se anima durante **todo** el timeline, no
  solo al final).
- El dibujo del trazo usa el mismo algoritmo `stroke-dasharray "2 2"
  repetido` que ya teníamos (idéntico, confirmado carácter por carácter).

**Diferencia clave con la versión anterior del código**: los offsets
0.85+i*0.05, 1.1, 0.45, 0.8, 0.05, 0.1 que había eran ajustes manuales que
NO existen en la referencia — la referencia usa ventanas mucho más
angostas y casi todo secuencial. El "problema" real (contenido cortado)
era la estructura de un solo nivel del pin (ver arriba), no la duración de
los tweens — con dos niveles correctos, las ventanas angostas originales
sí caben.

## 4. Mobile: modo "brand-snap" (3 pasos, sin scroll libre)

Solo activo si `innerWidth < 1024`, reemplaza el pin scrubbed de arriba
por completo. Estructura: un wrapper `h-dvh` fijo con **3 sub-secciones**
que se posicionan verticalmente con `y` (no se apilan por scroll):
1. dash-line + brand-image + brand-text (mismo contenido que
   `landingAdvance` ya reveló — el paso 1 empieza revelado).
2. dash-line-2 + brand-slogan + brand-image-2.
3. trazo + labels + wordmark final.

Cada swipe (`wheel deltaY` o `touchend` con umbral 30px, **sin** exigir
swipe rápido) avanza/retrocede un paso:
```js
offsets = {
  1: 0,
  2: -(step2.offsetTop - (0.25*innerHeight - navHeight + 33 + 14)),
  3: -(step3.offsetTop - (0.25*innerHeight - navHeight + 33 + 14)),
}
gsap.timeline({ onComplete })
  .to(contentWrapper, { y: offsets[step], duration:0.5, ease:"power3.out" }, 0)
  .to(logoEl,          { y: offsets[step], duration:0.5, ease:"power3.out" }, 0)
  .to(particlesBg,     { y: 0.15*offsets[step], duration:0.5, ease:"power3.out" }, 0)
```
Al AVANZAR a un paso (2 o 3), ese paso corre su propio `animateIn()`
(clipPath/opacity, ver abajo). Al RETROCEDER, el paso que se abandona
corre `animateOut()`. Cooldown 200ms igual que el resto; un segundo swipe
en cola durante la animación la acelera a `timeScale(10)`.

`animateIn`/`animateOut` de cada paso (self-contained, no dependen del
scroll):
- **Paso 1** (dash+image+text): `animateIn` = clip 100%→0% (0.5s), imagen
  opacity/y (0.4s @ 0.2), texto opacity/y (0.4s @ 0.3) — igual que
  `landingAdvance` desktop.
- **Paso 2** (dash-2+slogan+image2): mismo patrón, duraciones idénticas.
- **Paso 3** (trazo+labels+wordmark): `animateIn` = quita
  `strokeDasharray` del trazo entero (aparece dibujado de golpe, NO se
  redibuja progresivo en mobile), dot+arrow opacity:1 instantáneo, wrapper
  fade 0.4s, labels fade+y 0.4s con **delay 0.3s**, wordmark final fade+y
  0.4s con **delay 0.5s**. `animateOut` = un solo fade del wrapper (0.2s).

Bajar desde el paso 3 (`down` estando ya en 3) llama `onComplete` → pasa a
`whitePhase:"content"` (scroll libre normal, ya no queda más "brand-snap").
Subir desde el paso 1 (`up` estando en 1) llama `onExitUp` →
`transitionToHero()`.

## 5. Fondo de grano `brandParticles` (3 canvas 2D superpuestos)

Confirma y completa lo ya documentado en `BEHAVIORS.md` con los números
exactos del código fuente (no inferidos):

- Color único para las 3 capas: `rgb(80,80,80)`.
- 20 "atractores" (`Array.from({length:20})`), posición aleatoria en el
  contenedor, `spread = 40 + 300*random()` (rango real 40–340, coincide
  con lo documentado).
- **Capa o** (estática, pintada una vez con `putImageData`): `count:
  200000`, `alphaMin:10`, `alphaMax:60`. 60% de puntos cerca de un
  atractor (`Math.random()*spread` con una función `x()` gaussiana tipo
  Box-Muller, coincide con lo documentado), 40% uniforme.
- **Capa a** (estática): `count: 110000`, `alphaMin:15`, `alphaMax:90`,
  mismo reparto 60/40. Después, `8000` círculos pequeños
  (`arc(x,y,r,0,2π)`) con `r = 0.5 + 0.7*random()` (rango 0.5–1.2) y
  `alpha = 0.03 + 0.15*random()` (rango 0.03–0.18), 50% cerca de un
  atractor / 50% uniforme.
- **Capa c** (animada, redibujada cada frame con `clearRect`): `600`
  puntos, cada uno con `r = 0.5 + random()` (0.5–1.5), `alpha = 0.06 +
  0.22*random()` (0.06–0.28), fase y velocidad aleatorias
  (`speed: 0.012*(0.5+random())`). Órbita: `x = ox + 8*sin(t*speed+phase)`,
  `y = oy + 8*cos(t*speed*0.7+phase)*0.7` (**no es circular, es una
  elipse/Lissajous**, no una órbita simple sin/cos con la misma amplitud
  en ambos ejes).
- **Repulsión del cursor** (capa c únicamente): radio 120px, fuerza
  `(1 - dist/120) * 60`, `repelX/Y += (target - repelX/Y) * 0.15` cuando
  está dentro del radio, decae `*0.92` fuera de él — coincide exacto con
  `BEHAVIORS.md`.
- **Parallax de mouse** (lerp 0.06 sobre la posición normalizada del
  puntero dentro del contenedor), aplicado como `translate3d` CSS en cada
  capa: `o` ×10, `a` ×30, `c` ×20, más un término de deriva
  sinusoidal independiente por capa (amplitudes 6–14px, periodos
  distintos) — coincide con lo documentado.
- **Parallax de scroll** (nuevo, no estaba en `BEHAVIORS.md`):
  `setScrollParallax(progress, R)` desde el `onUpdate` del ScrollTrigger
  del pin — desplaza la capa `a` en Y por `progress * R * (0.85-1)` y la
  capa `o` por `-progress * R * 0.4` (una fracción del recorrido total del
  fondo `R`), sumado al parallax de mouse existente.
- API pública del componente: `{start, stop, setScrollParallax}`,
  expuesta como `el.__brandParticles` en el primer hijo del contenedor
  (así el padre puede arrancarlo/pausarlo sin pasar un ref explícito).
- Densidad reducida en mobile "brand-snap": se monta con `density: 0.2`
  (multiplica `count`, `8000` y `600` por 0.2) — variante ligera para el
  layout de 3 pasos.

**Color sobre el rosa de UTU**: el gris `rgb(80,80,80)` sobre el fondo
hueso `#f5f5f5` de la referencia da buen contraste; sobre nuestro rosa
`#FAA2CA` un gris puro se ve apagado. Se ajusta el color del grano a algo
más oscuro/saturado (a decidir en implementación, ej. `rgb(40,20,30)` o
similar tono sobre el mismo rosa) — es la única desviación deliberada de
un valor numérico exacto de este documento, todo lo demás (counts,
alphas, radios, velocidades, parallax) se porta literal.

## 6. Contenido texto/markup a portar 1:1 con datos de UTU

- 5 etiquetas del círculo en la referencia (`coffee`, `k-culture`,
  `everyday life`, `journeys`, `rituals`), posicionadas en
  `x=110, y=120+35*i` sobre el mismo `viewBox 0 0 220.52 359.55` y el
  mismo `path d=...`. UTU tiene 4 servicios
  (`ServicesSection.tsx`): Diseño de Marca / Diseño de Experiencia /
  Desarrollo Web / Producción de Contenido. Se usan 4 en vez de 5,
  reespaciadas dentro del mismo rango vertical del trazo (posiciones
  ajustadas, path SVG sin tocar).
- Wordmark final: en la referencia es una imagen PNG
  (`/home/StartWithMix.png`) con grano, no texto+filtro SVG. UTU ya tiene
  una versión propia como `<svg><text filter="url(#grain-text)">you to
  you</text></svg>` (con `feTurbulence`+`feDisplacementMap`) — se mantiene
  ese enfoque (texto real, no imagen) porque no hay un asset "you to you"
  pre-generado, y el filtro SVG ya reproduce visualmente el grano.
- Videos: `BrandStory_1.mp4`/`BrandStory_2.mp4` con sus posters, ya
  presentes en `public/sites/newmixcoffee-com-8d5a8741/shared/`. Se
  montan en `.brand-image`/`.brand-image-2` (hoy cajas vacías) con
  `autoPlay loop muted playsInline` + fallback a la imagen poster si
  `video.play()` falla (patrón `useVideoAutoplay`/`S()` de la
  referencia).

## Aproximaciones/decisiones anotadas
- Color del grano sobre rosa (§5, sin número exacto de la referencia).
- 4 etiquetas en vez de 5 (contenido real de UTU, decisión ya aprobada).
- Wordmark final como SVG+filtro en vez de PNG (no hay asset fuente).
- No se replica `setWhiteBgYOffset` visualmente porque ya existe como
  método en `heroEngine.ts`/`HeroCanvas.tsx` (fuera de alcance tocar el
  hero) — solo se llama con los valores exactos de arriba.

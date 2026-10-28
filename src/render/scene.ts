// Dibuja el estado de la simulación con PixiJS. No cambia el estado: solo lo lee.
import { Application, Container, Graphics, Sprite, Text, Texture, TilingSprite, type FederatedPointerEvent } from 'pixi.js';
import { BARN, BASKET, BOARD, CROPS, DOOR, FIELD, GROUP_PALETTE, HOUSE, IDLE_AREA, OLD_TREE, RIPE, ROTTEN, STATUE, WELL, WILT_WARNING, WORLD, type SeasonId } from '../sim/config';
import { basketMax, canEndSeason, fieldSize, groupOf, hasPorters, houseCapacity, isOpen, keepTime, plotAt, plotOrigin, seasonOf, waterTime } from '../sim/sim';
import type { Critter, GameState, Gnome, Pose } from '../sim/types';
import { ART, artTexture } from './pixelart';
import { CASA, MENUS, OFICIOS, RANKING, type MenuId } from '../textos';
import { drawBackground, drawField, drawGrassTile } from './background';
import { DecorView, TOWER, WELL_DRAW_H } from './decor';
import { BOARD_ROOF_GROUPS, drawBarn, drawBoard, drawHouse, drawOldTree, drawStatue, oldTreeStage, outlined, silhouette, STATUE_DRAW_W, statueTier } from './landmarks';
import { frameIndex, type Atlas } from './sprites';

const FONT = ['Pixelify Sans', 'monospace'];
/** pasos de zum del jugador por encima (y por debajo) del encuadre normal */
const ZOOM_MAX = 4;
const BASKET_SPRITE_W = 12;
const BASKET_SPRITE_H = 9;
/** hueco de la puerta del granero (16 × 17), donde se dibuja abierta */
const DOOR_RECT = { x: DOOR.x - 8, y: BARN.y + 28 } as const;
/** segundos que se queda abierta la puerta tras una entrega */
const DOOR_OPEN = 0.6;
/** lo que tarda un cultivo en volar de la planta a la mano */
const FLIGHT_TIME = 0.35;
/** fiesta de temporada nueva: lo que dura el confeti y el destello de la estatua */
const PARTY_TIME = 3;
const FLASH_TIME = 0.8;
/** sitios de la estatua (desde su esquina de arriba a la izquierda, sin contar los rayos) donde brilla cuando se puede acabar la temporada */
const GLINTS: [number, number][] = [[10, 2], [16, 8], [5, 9], [12, 13], [8, 6]];

/** Cuánto sube o baja el pecho del gnomo en cada fotograma respecto al de pie (para la medalla del veterano). */
function chestDy(pose: Pose, idx: number): number {
  switch (pose) {
    case 'walk': case 'carry': case 'complain': case 'scare': case 'watch': return idx % 2 === 1 ? -1 : 0;
    case 'sit': case 'fall': return 1;
    default: return 0;
  }
}

/** Elemento del huerto que abre un menú al pulsarlo. */
interface Landmark {
  menu: MenuId;
  /** nombre al pasar el ratón, si no es el del menú (la casa abre el granero) */
  label?: { lugar: string; sub: string };
  sprite: Sprite;
  normal: Texture;
  hover: Texture;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface GnomeView {
  root: Container;
  ring: Sprite;
  barrow: Sprite;
  body: Sprite;
  sack: Sprite;
  item: Sprite;
  sparkle: Sprite;
  bubble: Sprite;
  crown: Sprite;
  /** medalla de veterano en el pecho */
  medal: Sprite;
  /** qué bocadillo se dibujó por última vez, para el «pop» al cambiar */
  bubbleKey: string;
  pop: number;
}

interface CritterView {
  root: Container;
  shadow: Sprite;
  body: Sprite;
  state: Critter['state'];
  /** segundos en el estado actual (el reloj de la simulación no dice cuándo cambió) */
  stateAge: number;
}

interface Float {
  text: Text;
  x: number;
  y: number;
  t: number;
}

/** Cultivo que vuela de la planta a la mano del gnomo. */
interface Flight {
  sprite: Sprite;
  x: number;
  y: number;
  gnome: number;
  t: number;
}

interface Particle {
  sprite: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** gravedad (px/s²); negativa para que suba */
  g: number;
  t: number;
  life: number;
  /** confeti: se mece de lado a lado (vx es la amplitud) y solo se desvanece al final */
  flutter?: number;
}

/**
 * Cómo se ve cada estación (G10): tinte de la hierba y lo que cae. `every`: segundos entre partículas;
 * `fall`: velocidad de caída (px/s).
 */
const SEASON_LOOK: Record<SeasonId, { tint: number; kind: 'petals' | 'fireflies' | 'leaves' | 'snow'; particle: number; every: number; fall: number }> = {
  primavera: { tint: 0xffffff, kind: 'petals', particle: 0xffb8d0, every: 1.1, fall: 14 },
  verano: { tint: 0xfff0b8, kind: 'fireflies', particle: 0xfff3a0, every: 1.4, fall: 0 },
  otono: { tint: 0xeac48a, kind: 'leaves', particle: 0xe8873a, every: 0.8, fall: 18 },
  invierno: { tint: 0xc4d8ff, kind: 'snow', particle: 0xffffff, every: 0.35, fall: 12 },
};

export class SceneView {
  onPlotClick: (id: number) => void = () => {};
  onOpenMenu: (menu: MenuId) => void = () => {};
  onGnomeClick: (id: number) => void = () => {};

  private world = new Container();
  /** hierba que rellena la pantalla alrededor del mundo */
  private grass = new TilingSprite({ texture: artTexture(drawGrassTile()), width: 1, height: 1 });
  /** fondo del mundo (hierba, caminos); se tiñe con la estación */
  private ground = new Sprite(artTexture(drawBackground()));
  /** segundos hasta la próxima partícula de la estación */
  private seasonT = 0;
  private field = new Sprite();
  private entities = new Container();
  private marks = new Graphics();
  /** tierra mojada por el regador y grietas de sed (sobre el bancal, bajo las plantas) */
  private soil = new Graphics();
  private hover = new Graphics();
  /** efectos sobre todo lo demás: cultivos volando, polvo, lluvia de ranas, flecha del seguido */
  private fx = new Container();
  private rain = new Graphics();
  private marker: Sprite;
  private overlay = new Container();
  private plants: Sprite[] = [];
  private sparkles: Sprite[] = [];
  private basket: Sprite;
  private basketCount: Text;
  private door: Sprite;
  private doorT = 0;
  private pile: Sprite;
  /** montón junto al granero: crece con las entregas y se va vaciando solo (solo dibujo) */
  private pileCount = 0;
  private house: Landmark;
  private houseCount: Text;
  /** texturas de la casa por nivel (y pomo dorado), normal y resaltada */
  private houseTextures = new Map<string, { normal: Texture; hover: Texture; w: number; h: number }>();
  private houseKey = '0|false';
  /** granero, tablón, árbol viejo y estatua cambian de dibujo con las mejoras y los talentos (syncLandmarks) */
  private barn: Landmark;
  private board: Landmark;
  private tree: Landmark;
  private statue: Landmark;
  /** halo dorado detrás de la estatua (desde la 4.ª temporada y cuando se puede acabar la temporada) */
  private statueGlow = new Graphics();
  private statueGlowTier = -1;
  /** destellos sobre la estatua cuando se puede acabar la temporada */
  private glints: Sprite[] = [];
  /** silueta dorada de la estatua al empezar temporada, y lo que le queda */
  private statueFlash = new Sprite();
  private flashT = 0;
  /** nivel dibujado y texturas ya hechas de cada elemento que cambia */
  private landmarkLevels = new Map<Landmark, { key: string; cache: Map<string, { normal: Texture; hover: Texture; w: number; h: number }> }>();
  /** atrezo que cambia con las mejoras (decor.ts) */
  private decor = new DecorView(this.entities);
  private landmarks: Landmark[] = [];
  private hovered: Landmark | null = null;
  private gnomes = new Map<number, GnomeView>();
  private critters = new Map<number, CritterView>();
  private floats: Float[] = [];
  private flights: Flight[] = [];
  private particles: Particle[] = [];
  private nameTag: Text;
  private pointer: { x: number; y: number } | null = null;
  private state: GameState | null = null;
  private scale = 1;
  /** encuadre normal: escala entera y centro en el mundo */
  private baseScale = 1;
  private base = { x: 0, y: 0 };
  /** centro actual de la cámara en el mundo (se acerca poco a poco al objetivo) */
  private cam = { x: 0, y: 0 };
  private followId: number | null = null;
  /** zum del jugador: pasos de ART sobre el encuadre normal (negativo = más lejos) */
  private zoom = 0;
  /** centro elegido por el jugador al acercar o arrastrar; null = el encuadre normal */
  private pan: { x: number; y: number } | null = null;
  /** arrastre en curso (para mover la cámara) y punteros activos (para pellizcar con dos dedos) */
  private drag: { x: number; y: number; cam: { x: number; y: number }; moved: boolean } | null = null;
  private touches = new Map<number, { x: number; y: number }>();
  private pinch = 0;
  /** el último clic fue el final de un arrastre: no cuenta como clic */
  private dragged = false;
  private layoutKey = '';
  private fieldKey = '';
  private time = 0;
  /** pantalla tapada por la interfaz HTML (barra de abajo, ficha del gnomo a la derecha), en px de pantalla */
  private insets = { right: 0, bottom: 0 };

  constructor(private app: Application, private atlas: Atlas) {
    this.world.addChild(this.ground);
    this.field.position.set(FIELD.x - 2, FIELD.y - 2);
    this.entities.sortableChildren = true;
    this.marker = new Sprite(atlas.arrow);
    this.marker.anchor.set(0.5, 1);
    this.marker.visible = false;
    this.fx.addChild(this.rain, this.marker);
    this.world.addChild(this.field, this.soil, this.marks, this.entities, this.fx, this.hover);
    app.stage.addChild(this.grass, this.world, this.overlay);

    for (let i = 0; i < FIELD.maxCols * FIELD.maxRows; i++) {
      const plant = new Sprite(atlas.hole);
      const sparkle = new Sprite(atlas.sparkle);
      sparkle.visible = false;
      this.plants.push(plant);
      this.sparkles.push(sparkle);
      this.entities.addChild(plant, sparkle);
    }

    const addLandmark = (menu: MenuId, canvas: HTMLCanvasElement, x: number, y: number, label?: Landmark['label']) => {
      const normal = artTexture(canvas);
      const hover = artTexture(outlined(canvas));
      const sprite = new Sprite(normal);
      sprite.position.set(x, y);
      sprite.zIndex = y + canvas.height / ART;
      this.entities.addChild(sprite);
      const lm: Landmark = { menu, label, sprite, normal, hover, x, y, w: canvas.width / ART, h: canvas.height / ART };
      this.landmarks.push(lm);
      return lm;
    };
    this.barn = addLandmark('contratar', drawBarn(), BARN.x - 1, BARN.y);
    this.board = addLandmark('grupos', drawBoard(), BOARD.x, BOARD.y);
    this.tree = addLandmark('arbol', drawOldTree(), OLD_TREE.x, OLD_TREE.y);
    // la estatua se centra en su caja y se apoya en su base; crece con las temporadas
    const statue0 = drawStatue(0);
    this.statue = addLandmark('temporada', statue0, STATUE.x + (STATUE.w - STATUE_DRAW_W) / 2, STATUE.y + STATUE.h - statue0.height / ART);
    this.statueGlow.zIndex = STATUE.y + STATUE.h - 0.5;
    this.entities.addChild(this.statueGlow);
    for (let i = 0; i < 2; i++) {
      const glint = new Sprite(atlas.sparkle);
      glint.anchor.set(0.5);
      glint.visible = false;
      this.glints.push(glint);
    }
    this.statueFlash.visible = false;
    this.fx.addChild(this.statueFlash, ...this.glints);
    // la casa se apoya en la base de su caja; syncHouse cambia el dibujo cuando se amplía
    const house0 = drawHouse(0);
    this.house = addLandmark('contratar', house0, HOUSE.x, HOUSE.y + HOUSE.h - house0.height, { lugar: CASA.nombre, sub: MENUS.contratar.sub });
    this.houseTextures.set(this.houseKey, { normal: this.house.normal, hover: this.house.hover, w: house0.width, h: house0.height });

    this.basket = new Sprite(atlas.basket[0]);
    this.basket.position.set(BASKET.x - BASKET_SPRITE_W / 2, BASKET.y - 4 - BASKET_SPRITE_H);
    this.basket.zIndex = BASKET.y - 4;
    this.entities.addChild(this.basket);

    // la puerta abierta tapa la cerrada del dibujo del granero; el montón va a su derecha
    this.door = new Sprite(atlas.door[1]);
    this.door.position.set(DOOR_RECT.x, DOOR_RECT.y);
    this.door.zIndex = BARN.y + 46.5;
    this.door.visible = false;
    this.pile = new Sprite(atlas.pile[0]);
    this.pile.anchor.set(0, 1);
    this.pile.position.set(DOOR.x + 9, BARN.y + 49);
    this.pile.zIndex = BARN.y + 49;
    this.entities.addChild(this.door, this.pile);

    const tagStyle = { fontFamily: FONT, fontSize: 14, fill: '#f4f4f4', stroke: { color: '#1a1c2c', width: 4 }, align: 'center' as const };
    this.basketCount = new Text({ text: '', style: tagStyle });
    this.basketCount.anchor.set(0.5, 1);
    this.houseCount = new Text({ text: '', style: tagStyle });
    this.houseCount.anchor.set(0.5, 1);
    this.nameTag = new Text({ text: '', style: tagStyle });
    this.nameTag.anchor.set(0.5, 1);
    this.nameTag.visible = false;
    this.overlay.addChild(this.basketCount, this.houseCount, this.nameTag);

    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    app.stage.on('pointertap', (e: FederatedPointerEvent) => {
      if (!this.state) return;
      if (this.dragged) {
        this.dragged = false;
        return;
      }
      const l = this.world.toLocal(e.global);
      // los gnomos van delante de las parcelas y los edificios
      const g = this.gnomeAt(this.state, l.x, l.y);
      if (g) return this.onGnomeClick(g.id);
      const lm = this.landmarkAt(l.x, l.y);
      if (lm) return this.onOpenMenu(lm.menu);
      const id = plotAt(this.state, l.x, l.y);
      if (id !== null) this.onPlotClick(id);
    });
    app.stage.on('pointerdown', (e: FederatedPointerEvent) => {
      this.dragged = false;
      this.touches.set(e.pointerId, { x: e.global.x, y: e.global.y });
      if (this.touches.size === 2) {
        // dos dedos: se pellizca, no se arrastra
        this.drag = null;
        this.pinch = this.touchSpread();
        return;
      }
      if (e.button === 0) this.drag = { x: e.global.x, y: e.global.y, cam: { ...this.cam }, moved: false };
    });
    app.stage.on('pointermove', (e: FederatedPointerEvent) => {
      const l = this.world.toLocal(e.global);
      this.pointer = { x: l.x, y: l.y };
      if (this.touches.has(e.pointerId)) this.touches.set(e.pointerId, { x: e.global.x, y: e.global.y });
      if (this.touches.size === 2 && this.pinch > 0) {
        const spread = this.touchSpread();
        const [a, b] = [...this.touches.values()];
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (spread / this.pinch > 1.25) { this.zoomBy(1, mid); this.pinch = spread; }
        else if (spread / this.pinch < 0.8) { this.zoomBy(-1, mid); this.pinch = spread; }
        this.dragged = true;
        return;
      }
      const d = this.drag;
      if (!d || this.followId !== null) return;
      const dx = e.global.x - d.x, dy = e.global.y - d.y;
      if (!d.moved && Math.hypot(dx, dy) < 6) return;
      d.moved = true;
      this.dragged = true;
      this.pan = this.clampPan({ x: d.cam.x - dx / this.scale, y: d.cam.y - dy / this.scale }, this.scale);
      this.cam = { ...this.pan };
    });
    const release = (e: FederatedPointerEvent) => {
      this.touches.delete(e.pointerId);
      if (this.touches.size < 2) this.pinch = 0;
      this.drag = null;
    };
    app.stage.on('pointerup', release);
    app.stage.on('pointerupoutside', release);
    app.stage.on('pointerleave', () => (this.pointer = null));
    // la rueda del ratón acerca y aleja hacia donde apunta
    let wheel = 0;
    app.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      wheel += e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
      if (Math.abs(wheel) < 80) return;
      const r = app.canvas.getBoundingClientRect();
      this.zoomBy(wheel < 0 ? 1 : -1, { x: e.clientX - r.left, y: e.clientY - r.top });
      wheel = 0;
    }, { passive: false });
  }

  private touchSpread() {
    const [a, b] = [...this.touches.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  /** Escala con el zum del jugador: de ART en ART, entre ART (o 1) y ZOOM_MAX pasos sobre el encuadre normal. */
  private zoomScale(zoom = this.zoom) {
    const B = this.baseScale;
    const min = B >= ART ? ART : 1;
    return Math.min(B + ZOOM_MAX * ART, Math.max(min, B + zoom * ART));
  }

  /** Pasos de zum que se pueden dar desde aquí (para que los botones sepan si están al límite). */
  get zoomRange(): { canIn: boolean; canOut: boolean; zoomed: boolean } {
    return {
      canIn: this.zoomScale(this.zoom + 1) !== this.zoomScale(),
      canOut: this.zoomScale(this.zoom - 1) !== this.zoomScale(),
      zoomed: this.zoom !== 0 || this.pan !== null,
    };
  }

  /**
   * Acerca (+1) o aleja (−1) un paso. Con `anchor` (px de pantalla), el punto del mundo que hay debajo se queda quieto;
   * sin él, se acerca hacia el centro de la vista.
   */
  zoomBy(steps: number, anchor?: { x: number; y: number }) {
    const before = this.zoomScale();
    const next = Math.max(-ZOOM_MAX, Math.min(ZOOM_MAX, this.zoom + steps));
    const after = this.zoomScale(next);
    if (after === before) return;
    this.zoom = next;
    if (this.followId !== null) return;
    // de vuelta al zum normal, también al encuadre normal (la cámara se desliza hasta él)
    if (next === 0) {
      this.pan = null;
      return;
    }
    const { w, h } = this.view();
    const a = anchor ?? { x: w / 2, y: h / 2 };
    const wx = (a.x - this.world.x) / this.scale, wy = (a.y - this.world.y) / this.scale;
    this.pan = this.clampPan({ x: wx - (a.x - w / 2) / after, y: wy - (a.y - h / 2) / after }, after);
    this.cam = { ...this.pan };
  }

  /** Vuelve al encuadre normal. */
  resetZoom() {
    this.zoom = 0;
    this.pan = null;
  }

  /** lo que se ve del lienzo sin la interfaz, en px de pantalla */
  private view() {
    const { width: sw, height: sh } = this.app.screen;
    return { w: Math.max(1, sw - this.insets.right), h: Math.max(1, sh - this.insets.bottom) };
  }

  /** Centro de cámara que no enseña más allá del borde del mundo (si el mundo cabe entero, centrado). */
  private clampPan(p: { x: number; y: number }, S: number) {
    const { w, h } = this.view();
    const hw = w / 2 / S, hh = h / 2 / S;
    return {
      x: WORLD.w <= hw * 2 ? WORLD.w / 2 : Math.min(Math.max(p.x, hw), WORLD.w - hw),
      y: WORLD.h <= hh * 2 ? WORLD.h / 2 : Math.min(Math.max(p.y, hh), WORLD.h - hh),
    };
  }

  /** Gnomo que sigue la cámara, o null con el encuadre normal. */
  get followed(): number | null {
    return this.followId;
  }

  /** La cámara se acerca un paso de escala entera y mantiene centrado al gnomo; null vuelve al encuadre normal. */
  follow(id: number | null) {
    this.followId = id;
  }

  /** Lo que tapa la interfaz: el encuadre se ajusta y se centra en el resto de la pantalla. */
  setInsets(i: { right: number; bottom: number }) {
    if (i.right === this.insets.right && i.bottom === this.insets.bottom) return;
    this.insets = { right: i.right, bottom: i.bottom };
  }

  /** Borra las vistas de los gnomos (al empezar partida nueva). */
  reset() {
    for (const v of this.gnomes.values()) v.root.destroy({ children: true });
    this.gnomes.clear();
    for (const v of this.critters.values()) v.root.destroy({ children: true });
    this.critters.clear();
    for (const f of this.floats) f.text.destroy();
    this.floats = [];
    for (const f of this.flights) f.sprite.destroy();
    this.flights = [];
    for (const p of this.particles) p.sprite.destroy();
    this.particles = [];
    this.pileCount = 0;
    this.doorT = 0;
    this.flashT = 0;
    this.follow(null);
  }

  sync(s: GameState, dt: number) {
    this.state = s;
    this.time += dt;
    this.syncField(s);
    this.layout(s);
    this.camera(s, dt);
    this.syncPlants(s);
    this.syncBasket(s);
    this.syncHouse(s);
    this.syncLandmarks(s);
    this.syncStatue(s, dt);
    this.decor.sync(s);
    this.syncGnomes(s, dt);
    this.syncCritters(s, dt);
    this.syncMarks(s);
    this.syncEvents(s, dt);
    this.syncBarnDoor(dt);
    this.syncRain(s);
    this.syncSeason(s, dt);
    this.syncMarker(s);
    this.syncHover(s);
  }

  private syncField(s: GameState) {
    const f = fieldSize(s);
    const key = `${f.cols}x${f.rows}|${s.tree.abono}|${s.prestige.talents.abonoDorado}`;
    if (key === this.fieldKey) return;
    this.fieldKey = key;
    const old = this.field.texture;
    this.field.texture = artTexture(drawField(f.cols, f.rows, s.tree.abono, s.prestige.talents.abonoDorado));
    if (old !== Texture.EMPTY) old.destroy(true);
  }

  /**
   * Estación (G10): la hierba cambia de tono y cae algo propio de cada una (pétalos, luciérnagas, hojas, nieve).
   * Poco y lento, para que acompañe sin distraer.
   */
  private syncSeason(s: GameState, dt: number) {
    const look = SEASON_LOOK[seasonOf(s)];
    if (this.ground.tint !== look.tint) {
      this.ground.tint = look.tint;
      this.grass.tint = look.tint;
    }
    this.seasonT -= dt;
    if (this.seasonT > 0) return;
    this.seasonT = look.every * (0.6 + Math.random() * 0.8);
    const x = Math.random() * WORLD.w;
    if (look.kind === 'fireflies') {
      // luciérnagas: suben despacio desde la hierba
      this.addParticle(this.atlas.sparkle, x, WORLD.h * (0.3 + Math.random() * 0.7), (Math.random() - 0.5) * 6, -6, 0, 2.5, 3, look.particle);
    } else {
      const tex = look.kind === 'snow' ? this.atlas.dust : this.atlas.confetti[Math.floor(Math.random() * this.atlas.confetti.length)];
      this.addParticle(tex, x, -6, 3 + Math.random() * 6, look.fall + Math.random() * 8, 0, WORLD.h / look.fall + 1, 5, look.particle);
    }
  }

  /** Dibujo de la casa según su nivel y el pomo dorado (cada uno se dibuja una vez) y cartel de camas ocupadas. */
  private syncHouse(s: GameState) {
    const lm = this.house;
    const golden = s.prestige.talents.casaHeredada > 0;
    const key = `${s.house}|${golden}`;
    if (key !== this.houseKey) {
      this.houseKey = key;
      let tex = this.houseTextures.get(key);
      if (!tex) {
        const canvas = drawHouse(s.house, golden);
        tex = { normal: artTexture(canvas), hover: artTexture(outlined(canvas)), w: canvas.width / ART, h: canvas.height / ART };
        this.houseTextures.set(key, tex);
      }
      lm.normal = tex.normal;
      lm.hover = tex.hover;
      lm.w = tex.w;
      lm.h = tex.h;
      lm.y = HOUSE.y + HOUSE.h - tex.h;
      const hovered = this.hovered === lm;
      lm.sprite.texture = hovered ? lm.hover : lm.normal;
      lm.sprite.position.set(lm.x - (hovered ? 1 : 0), lm.y - (hovered ? 1 : 0));
    }
    const beds = houseCapacity(s);
    this.houseCount.visible = this.hovered !== lm;
    this.houseCount.text = `${s.gnomes.length}/${beds}`;
    this.houseCount.style.fill = s.gnomes.length >= beds ? '#e8687d' : '#f4f4f4';
    const p = this.toScreen(HOUSE.x + HOUSE.w / 2, lm.y - 2);
    this.houseCount.position.set(p.x, p.y);
  }

  /** Granero (mercado y gremio), tablón (grupos), árbol viejo (mejoras compradas) y estatua (temporada) según el progreso; los talentos dejan su marca. */
  private syncLandmarks(s: GameState) {
    const t = s.tree, tal = s.prestige.talents;
    const gilded = tal.mercadoDorado > 0, contract = tal.contrato > 0;
    this.redrawLandmark(this.barn, `${t.mercado}|${t.porteadores > 0}|${gilded}|${contract}`, () => drawBarn(t.mercado, t.porteadores > 0, gilded, contract), BARN.y + 46);
    const notes = Math.min(s.groups.length, BOARD_ROOF_GROUPS);
    const photo = tal.experiencia > 0;
    this.redrawLandmark(this.board, `${notes}|${photo}`, () => drawBoard(notes, photo), BOARD.y + BOARD.h);
    const stage = oldTreeStage(s);
    this.redrawLandmark(this.tree, `${stage}`, () => drawOldTree(stage), OLD_TREE.y + OLD_TREE.h);
    const tier = statueTier(s.prestige.season);
    this.redrawLandmark(this.statue, `${tier}`, () => drawStatue(tier), STATUE.y + STATUE.h);
  }

  /**
   * La estatua cobra vida: halo dorado que respira desde la 4.ª temporada, halo más fuerte y destellos
   * cuando ya se puede acabar la temporada, y el destello dorado al empezar una nueva.
   */
  private syncStatue(s: GameState, dt: number) {
    const lm = this.statue;
    const tier = statueTier(s.prestige.season);
    const cx = lm.x + STATUE_DRAW_W / 2, headY = lm.y + lm.h - (tier === 0 ? 5 : 9) - 12;
    if (tier !== this.statueGlowTier) {
      this.statueGlowTier = tier;
      this.statueGlow.clear().circle(cx, headY, 10).fill({ color: 0xffcd75 }).circle(cx, headY, 6).fill({ color: 0xffcd75 });
    }
    const ready = canEndSeason(s);
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 3);
    this.statueGlow.alpha = (ready ? 0.12 + 0.14 * pulse : 0) + (tier === 2 ? 0.08 + 0.04 * pulse : 0);
    this.statueGlow.visible = this.statueGlow.alpha > 0;
    // dos destellos que van saltando de sitio, a destiempo
    const top = lm.y + lm.h - (tier === 0 ? 5 : 9) - 17;
    this.glints.forEach((glint, i) => {
      const phase = this.time * 1.4 + i * 0.5;
      const [gx, gy] = GLINTS[(Math.floor(phase) * 3 + i * 2) % GLINTS.length];
      const k = phase % 1;
      glint.visible = ready && k < 0.45;
      glint.position.set(lm.x + gx, top + gy);
      glint.scale.set(k < 0.1 || k > 0.35 ? 0.6 : 1);
    });
    this.flashT = Math.max(0, this.flashT - dt);
    this.statueFlash.visible = this.flashT > 0;
    if (this.statueFlash.visible) {
      this.statueFlash.position.set(lm.x, lm.y);
      this.statueFlash.alpha = this.flashT / FLASH_TIME;
    }
  }

  /** Fiesta de temporada nueva: confeti y hojas doradas cayendo sobre el huerto y destello en la estatua. */
  private celebrate() {
    for (let i = 0; i < 70; i++) {
      const tex = this.atlas.confetti[i % this.atlas.confetti.length];
      const x = Math.random() * WORLD.w, y = -4 - Math.random() * 70;
      this.addParticle(tex, x, y, 4 + Math.random() * 8, 35 + Math.random() * 25, 0, PARTY_TIME + Math.random() * 0.8, Math.random() * 6);
    }
    const canvas = drawStatue(statueTier(this.state?.prestige.season ?? 1));
    const old = this.statueFlash.texture;
    this.statueFlash.texture = artTexture(silhouette(canvas, '#fff4c2'));
    if (old !== Texture.EMPTY) old.destroy(true);
    this.flashT = FLASH_TIME;
  }

  /** Cambia el dibujo de un elemento pulsable si cambia su nivel (cada nivel se dibuja una vez); se apoya en `bottom`. */
  private redrawLandmark(lm: Landmark, key: string, draw: () => HTMLCanvasElement, bottom: number) {
    let entry = this.landmarkLevels.get(lm);
    if (!entry) this.landmarkLevels.set(lm, (entry = { key: '', cache: new Map() }));
    if (entry.key === key) return;
    entry.key = key;
    let tex = entry.cache.get(key);
    if (!tex) {
      const canvas = draw();
      tex = { normal: artTexture(canvas), hover: artTexture(outlined(canvas)), w: canvas.width / ART, h: canvas.height / ART };
      entry.cache.set(key, tex);
    }
    lm.normal = tex.normal;
    lm.hover = tex.hover;
    lm.w = tex.w;
    lm.h = tex.h;
    lm.y = bottom - tex.h;
    lm.sprite.zIndex = bottom;
    const hovered = this.hovered === lm;
    lm.sprite.texture = hovered ? lm.hover : lm.normal;
    lm.sprite.position.set(lm.x - (hovered ? 1 : 0), lm.y - (hovered ? 1 : 0));
  }

  /** Elemento pulsable bajo un punto del mundo (por su caja, con un pequeño margen). */
  private landmarkAt(x: number, y: number): Landmark | null {
    return this.landmarks.find(l => x >= l.x - 1 && x <= l.x + l.w && y >= l.y - 1 && y <= l.y + l.h) ?? null;
  }

  /** Gnomo bajo un punto del mundo; si se solapan, el que está más delante. */
  private gnomeAt(s: GameState, x: number, y: number): Gnome | null {
    let best: Gnome | null = null;
    for (const g of s.gnomes) {
      if (Math.abs(x - g.x) > 6 || y > g.y + 1 || y < g.y - 16) continue;
      if (!best || g.y > best.y) best = g;
    }
    return best;
  }

  /**
   * El encuadre normal enseña el granero, el bancal abierto y la estatua con la mayor escala que quepa. Con el arte a
   * doble resolución (ART), la escala va de ART en ART para que cada píxel del dibujo ocupe píxeles enteros de pantalla.
   */
  private layout(s: GameState) {
    const { width: sw, height: sh } = this.app.screen;
    // el encuadre cabe en lo que no tapa la interfaz
    const w = Math.max(1, sw - this.insets.right), h = Math.max(1, sh - this.insets.bottom);
    const key = `${sw}x${sh}|${this.insets.right}x${this.insets.bottom}|${this.fieldKey}|${s.tree.regadores > 0}|${s.tree.guardianes > 0}`;
    if (key === this.layoutKey) return;
    const first = this.layoutKey === '';
    this.layoutKey = key;

    const f = fieldSize(s);
    // el pozo y la atalaya solo cuentan cuando se ven
    const well = s.tree.regadores > 0, tower = s.tree.guardianes > 0;
    const x0 = OLD_TREE.x - 4;
    const y0 = Math.min(BARN.y - 12, well ? WELL.y + WELL.h - WELL_DRAW_H - 2 : Infinity, tower ? TOWER.y - 2 : Infinity);
    // la estatua siempre se ve (con el cofre de la herencia a su pie, que llega casi al borde del mundo)
    const x1 = Math.max(FIELD.x + f.cols * FIELD.cell + 12, tower ? TOWER.x + TOWER.w + 4 : 0, STATUE.x + STATUE.w + 4);
    // margen justo bajo el bancal (cabe la valla): con el arte doble, unas unidades deciden si cabe la escala siguiente
    const y1 = Math.max(FIELD.y + f.rows * FIELD.cell + 8, IDLE_AREA.y1 + 8, OLD_TREE.y + OLD_TREE.h + 4);
    const bw = x1 - x0, bh = y1 - y0;
    const fit = Math.min(w / bw, h / bh);
    this.baseScale = fit >= ART ? Math.floor(fit / ART) * ART : Math.max(1, Math.floor(fit));
    this.base = { x: x0 + bw / 2, y: y0 + bh / 2 };
    // al cambiar el tamaño de la ventana no hace falta un paseo de cámara (salvo con zum o arrastre del jugador)
    if (first || (this.followId === null && this.pan === null)) this.cam = { ...this.base };
    this.grass.width = sw;
    this.grass.height = sh;
  }

  /**
   * Escala entera y posición del mundo. Con zum o arrastre del jugador, su encuadre. Siguiendo a un gnomo: un paso más
   * de zum y el gnomo en el centro. Nunca enseña más allá del borde del mundo; la posición se redondea para que los
   * píxeles no tiemblen.
   */
  private camera(s: GameState, dt: number) {
    const { w, h } = this.view();
    const g = this.followId === null ? undefined : s.gnomes.find(g => g.id === this.followId);
    const Z = this.zoomScale();
    // siguiendo a un gnomo, un paso más de zum (de ART en ART)
    const S = g ? (Z % ART === 0 ? Z + ART : Z + 1) : Z;
    let target = this.base;
    if (g) target = this.clampPan({ x: g.x, y: g.y - 8 }, S);
    else if (this.pan) target = this.pan = this.clampPan(this.pan, S);
    const tx = target.x, ty = target.y;
    if (S !== this.scale) {
      this.scale = S;
      this.world.scale.set(S);
      this.grass.tileScale.set(S);
      for (const t of [this.nameTag, this.basketCount, this.houseCount]) {
        t.style.fontSize = Math.max(12, 4 * S);
        t.style.stroke = { color: '#1a1c2c', width: Math.max(3, S) };
      }
    }
    const k = 1 - Math.exp(-dt * 6);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
    // al llegar se encaja exacto
    if (!g && Math.abs(tx - this.cam.x) < 0.5 / S && Math.abs(ty - this.cam.y) < 0.5 / S) this.cam = { x: tx, y: ty };
    this.world.position.set(Math.floor(w / 2 - this.cam.x * S), Math.floor(h / 2 - this.cam.y * S));
    this.grass.tilePosition.set(this.world.x, this.world.y);
  }

  private toScreen(x: number, y: number) {
    return { x: this.world.x + x * this.scale, y: this.world.y + y * this.scale };
  }

  /** Un punto del mundo en coordenadas de la página (para efectos HTML encima del lienzo). */
  pageOf(x: number, y: number) {
    const r = this.app.canvas.getBoundingClientRect();
    const p = this.toScreen(x, y);
    return { x: r.left + (p.x * r.width) / this.app.screen.width, y: r.top + (p.y * r.height) / this.app.screen.height };
  }

  private syncPlants(s: GameState) {
    const soil = this.soil;
    soil.clear();
    const wetMax = waterTime(s);
    for (const p of s.plots) {
      const sp = this.plants[p.id];
      const sparkle = this.sparkles[p.id];
      const open = isOpen(s, p);
      sp.visible = open;
      sparkle.visible = false;
      if (!open) continue;
      const o = plotOrigin(p);
      if (p.wet > 0) {
        // regada: la tierra se oscurece y se va aclarando según se seca
        soil.rect(o.x, o.y, FIELD.cell, FIELD.cell).fill({ color: 0x1a1c2c, alpha: 0.3 * Math.min(1, p.wet / wetMax) });
      } else if (CROPS[p.crop].thirsty && p.stage >= 0 && p.stage < RIPE) {
        // con sed y seca: grietas claras en la tierra, para que se note que le falta agua
        for (const [x, y] of [[3, 14], [4, 15], [5, 15], [6, 14], [7, 15], [11, 13], [12, 14], [13, 14], [14, 15], [12, 12]]) soil.rect(o.x + x, o.y + y, 1, 1);
        soil.fill({ color: 0xe0b07a, alpha: 0.75 });
      }
      sp.zIndex = o.y + 15;
      if (p.stage < 0) {
        sp.texture = this.atlas.hole;
        sp.anchor.set(0, 0);
        sp.scale.x = 1;
        sp.position.set(o.x + 6, o.y + 12);
        continue;
      }
      const ripe = p.stage === RIPE;
      const wilting = ripe && p.t >= keepTime(s, p.crop) * WILT_WARNING;
      // de vez en cuando una ráfaga mece la planta 1 px; cada parcela a su ritmo
      const sway = p.stage > 0 && p.stage !== ROTTEN && Math.sin(this.time * 1.6 + p.id * 2.3) > 0.8;
      const a = this.atlas;
      sp.texture = wilting
        ? (sway ? a.passingSway : a.passing)[p.crop]
        : (sway ? a.plantsSway : a.plants)[p.crop][p.stage];
      sp.anchor.set(0.5, 0);
      // parte de las plantas en espejo, para que el bancal no parezca copiado y pegado
      sp.scale.x = (p.id * 7) % 3 === 0 ? -1 : 1;
      const bounce = ripe && !wilting && Math.sin(this.time * 5 + p.id * 1.7) > 0.6 ? -1 : 0;
      sp.position.set(o.x + 9, o.y + 2 + bounce);
      // cosecha dorada (G4): la planta madura brilla en oro y suelta destellos a menudo
      const golden = ripe && p.golden;
      sp.tint = golden ? 0xffd75e : 0xffffff;
      sparkle.zIndex = o.y + 16;
      if (p.stage === ROTTEN) {
        // una mosca da vueltas sobre lo echado a perder
        const a = this.time * 3 + p.id;
        sparkle.texture = this.atlas.fly;
        sparkle.position.set(Math.round(o.x + 8 + Math.cos(a) * 5), Math.round(o.y + 3 + Math.sin(a * 1.7) * 2));
        sparkle.visible = true;
      } else if (ripe && (golden || !wilting)) {
        sparkle.texture = this.atlas.sparkle;
        const k = golden ? Math.floor(this.time * 4 + p.id) % 3 : 0;
        sparkle.position.set(o.x + 12 - k * 4, o.y + 1 + (k % 2) * 4);
        sparkle.visible = Math.sin(this.time * (golden ? 9 : 2.3) + p.id * 2.1) > (golden ? 0.2 : 0.93);
      }
    }
  }

  private syncBasket(s: GameState) {
    const show = hasPorters(s) || s.basket.length > 0;
    this.basket.visible = show;
    this.basketCount.visible = show;
    if (!show) return;
    const max = basketMax(s);
    const fill = s.basket.length / max;
    const level = s.basket.length === 0 ? 0 : fill <= 0.25 ? 1 : fill <= 0.5 ? 2 : fill < 0.9 ? 3 : 4;
    this.basket.texture = this.atlas.basket[level];
    this.basketCount.text = `${s.basket.length}/${max}`;
    this.basketCount.style.fill = fill >= 1 ? '#e8687d' : '#f4f4f4';
    const p = this.toScreen(BASKET.x, BASKET.y - 4 - BASKET_SPRITE_H - 1);
    this.basketCount.position.set(p.x, p.y);
  }

  private makeGnomeView(): GnomeView {
    const root = new Container();
    const shadow = new Sprite(this.atlas.shadow);
    shadow.position.set(-5, 0);
    const ring = new Sprite(this.atlas.rings[0]);
    ring.position.set(-6, -1);
    const barrow = new Sprite();
    barrow.anchor.set(0, 1);
    const body = new Sprite();
    body.anchor.set(0.5, 1);
    const sack = new Sprite();
    sack.anchor.set(0, 1);
    const item = new Sprite();
    const sparkle = new Sprite(this.atlas.sparkle);
    sparkle.anchor.set(0.5);
    const bubble = new Sprite();
    bubble.anchor.set(0, 1);
    const crown = new Sprite(this.atlas.crown);
    const medal = new Sprite(this.atlas.medal);
    medal.visible = false;
    root.addChild(shadow, ring, barrow, body, medal, sack, item, sparkle, bubble, crown);
    this.entities.addChild(root);
    return { root, ring, barrow, body, sack, item, sparkle, bubble, crown, medal, bubbleKey: '', pop: 0 };
  }

  private syncGnomes(s: GameState, dt: number) {
    const alive = new Set<number>();
    for (const g of s.gnomes) {
      alive.add(g.id);
      let v = this.gnomes.get(g.id);
      if (!v) {
        v = this.makeGnomeView();
        this.gnomes.set(g.id, v);
      }
      this.drawGnome(s, g, v, dt);
    }
    for (const [id, v] of this.gnomes) {
      if (alive.has(id)) continue;
      v.root.destroy({ children: true });
      this.gnomes.delete(id);
    }
    if (this.followId !== null && !alive.has(this.followId)) this.follow(null);
  }

  private drawGnome(s: GameState, g: Gnome, v: GnomeView, dt: number) {
    v.root.position.set(Math.round(g.x), Math.round(g.y));
    v.root.zIndex = g.y;
    v.ring.texture = this.atlas.rings[groupOf(s, g).color];
    const frames = (g.legendary ? this.atlas.legendary : this.atlas.gnome)[g.job][g.pose];
    const idx = frameIndex(g.pose, g.t) % frames.length;
    v.body.texture = frames[idx];
    const dir = g.flip ? -1 : 1;
    v.body.scale.x = dir;

    // la carga: los porteadores con carretilla la empujan delante; los demás llevan un saco que crece
    const loaded = g.pose === 'carry' && g.carry.length > 0;
    const pushing = loaded && g.job === 'porteador' && s.tree.carretilla > 0;
    v.barrow.visible = pushing;
    v.sack.visible = loaded && !pushing;
    const bob = idx % 2 === 1 ? -1 : 0;
    if (pushing) {
      v.barrow.texture = this.atlas.barrow[Math.floor(g.t * 8) % 2];
      v.barrow.scale.x = dir;
      v.barrow.position.set(3 * dir, 2);
    } else if (loaded) {
      const n = g.carry.length;
      v.sack.texture = this.atlas.sacks[n <= 1 ? 0 : n <= 3 ? 1 : 2];
      v.sack.scale.x = dir;
      v.sack.position.set(dir, -4 + bob);
    }

    // al recoger, el cultivo asoma en la mano en el segundo fotograma
    const plot = g.task?.kind === 'harvest' && g.task.plot !== undefined ? s.plots[g.task.plot] : null;
    v.item.visible = g.pose === 'harvest' && idx === 1 && plot !== null;
    if (plot) {
      v.item.texture = this.atlas.items[plot.crop];
      v.item.position.set(g.flip ? -7 : 4, -9);
    }

    // el legendario suelta un destello de vez en cuando sobre el gorro dorado
    v.sparkle.visible = g.legendary && Math.sin(this.time * 2.1 + g.id * 1.3) > 0.9;
    if (v.sparkle.visible) v.sparkle.position.set(((g.id * 5 + Math.floor(this.time / 3)) % 7) - 3, -13 + (Math.floor(this.time) % 3));

    const b = g.bubble;
    const tex = !b ? undefined : b.kind === 'crop' ? (b.crop ? this.atlas.cropBubbles[b.crop] : undefined) : this.atlas.bubbles[b.kind];
    v.bubble.visible = tex !== undefined;
    if (b && tex) {
      const key = b.kind === 'crop' ? `crop:${b.crop}` : b.kind;
      if (key !== v.bubbleKey) {
        v.bubbleKey = key;
        v.bubble.texture = tex;
        v.pop = 0;
      }
      // aparece de golpe: pequeño, grande y a su tamaño
      v.pop += dt;
      v.bubble.scale.set(v.pop < 0.05 ? 0.5 : v.pop < 0.1 ? 1.25 : 1);
      // las zz suben y bajan
      v.bubble.position.set(1, -15 - (b.kind === 'zz' ? Math.floor(g.t * 2) % 2 : 0));
    } else {
      v.bubbleKey = '';
    }
    // la corona flota sobre el gorro; se aparta mientras hay bocadillo
    v.crown.visible = s.crowns[g.job] === g.id && !v.bubble.visible;
    if (v.crown.visible) v.crown.position.set(-3, -23 - (Math.floor(g.t * 2) % 2));
    // el veterano (coronado en otra temporada que ha vuelto) lleva su medalla en el pecho, bajo la barba
    v.medal.visible = s.prestige.veterans.some(vet => vet.name === g.name);
    if (v.medal.visible) v.medal.position.set(g.flip ? -3 : 1, -5 + chestDy(g.pose, idx));
  }

  private syncCritters(s: GameState, dt: number) {
    const alive = new Set<number>();
    for (const c of s.critters) {
      alive.add(c.id);
      let v = this.critters.get(c.id);
      if (!v) {
        const root = new Container();
        const shadow = new Sprite(this.atlas.shadow);
        shadow.anchor.set(0.5, 0);
        const body = new Sprite();
        body.anchor.set(0.5, 1);
        root.addChild(shadow, body);
        this.entities.addChild(root);
        v = { root, shadow, body, state: c.state, stateAge: 0 };
        this.critters.set(c.id, v);
      }
      if (v.state !== c.state) {
        v.state = c.state;
        v.stateAge = 0;
      }
      v.stateAge += dt;
      this.drawCritter(c, v);
    }
    for (const [id, v] of this.critters) {
      if (alive.has(id)) continue;
      v.root.destroy({ children: true });
      this.critters.delete(id);
    }
  }

  private drawCritter(c: Critter, v: CritterView) {
    const a = this.atlas;
    v.root.position.set(Math.round(c.x), Math.round(c.y));
    v.root.zIndex = c.y;
    v.body.scale.x = c.flip ? -1 : 1;
    v.body.y = 0;
    v.shadow.visible = true;
    const moving = Math.hypot(c.tx - c.x, c.ty - c.y) > 0.5;
    switch (c.kind) {
      case 'cuervo': {
        // vuela por encima de todo; en la parcela picotea a ratos
        const flying = c.state !== 'stay';
        v.body.texture = flying ? a.crowFly[Math.floor(this.time * 8) % 2] : a.crowPeck[Math.sin(this.time * 5 + c.id) > 0.4 ? 1 : 0];
        if (flying) v.body.scale.x = 1;
        v.shadow.visible = !flying;
        v.shadow.scale.x = 0.9;
        if (flying) v.root.zIndex = 10000;
        break;
      }
      case 'caracol':
        v.body.texture = a.snail[Math.floor(c.t * 1.5) % 2];
        v.shadow.scale.x = 1.1;
        break;
      case 'topo': {
        // asoma, se queda mirando (a veces se agacha) y se esconde; el montículo se queda
        const rise = c.state === 'in' ? Math.min(5, Math.floor(v.stateAge * 12))
          : c.state === 'out' ? Math.max(0, 5 - Math.floor(v.stateAge * 12))
          : Math.sin(this.time * 1.3 + c.id) > 0.85 ? 2 : 5;
        v.body.texture = a.mole[rise];
        v.body.scale.x = 1;
        v.shadow.visible = false;
        break;
      }
      case 'mariposa':
        // la simulación ya la pone en el aire (unos 12 px sobre la hierba): se ordena por el suelo que tiene debajo
        v.body.texture = a.butterfly[c.id % a.butterfly.length][Math.floor(this.time * 10 + c.id) % 2];
        v.body.y = Math.round(Math.sin(this.time * 4 + c.id) * 1.5);
        v.shadow.visible = false;
        v.root.zIndex = c.y + 12;
        break;
      case 'rana': {
        // cayendo del cielo: patas estiradas y sin sombra; luego se va a saltos
        const falling = c.state === 'in';
        const hop = falling || ((moving || c.state === 'out') && Math.floor(v.stateAge * 4 + c.id) % 2 === 1);
        v.body.texture = a.frog[hop ? 1 : 0];
        v.body.y = hop && !falling ? -2 : 0;
        v.shadow.visible = !falling;
        v.shadow.scale.x = 0.7;
        break;
      }
    }
  }

  /**
   * Borde punteado del color del grupo alrededor de cada zona (A5) y esquinas en la parcela a la que va cada gnomo:
   * así se ven la zona y la prioridad en acción.
   */
  private syncMarks(s: GameState) {
    const m = this.marks;
    m.clear();
    const f = fieldSize(s);
    s.groups.forEach((gr, i) => {
      const z = gr.zone;
      if (!z || z.c0 >= f.cols || z.r0 >= f.rows) return;
      // las zonas que se tocan no se pisan el borde: cada grupo un poco más adentro
      const inset = 1 + (i % 3);
      const x0 = FIELD.x + z.c0 * FIELD.cell + inset, y0 = FIELD.y + z.r0 * FIELD.cell + inset;
      const x1 = FIELD.x + (Math.min(z.c1, f.cols - 1) + 1) * FIELD.cell - 1 - inset;
      const y1 = FIELD.y + (Math.min(z.r1, f.rows - 1) + 1) * FIELD.cell - 1 - inset;
      const DASH = 3, GAP = 2;
      for (let x = x0; x <= x1; x += DASH + GAP) {
        const w = Math.min(DASH, x1 - x + 1);
        m.rect(x, y0, w, 1).rect(x, y1, w, 1);
      }
      for (let y = y0; y <= y1; y += DASH + GAP) {
        const h = Math.min(DASH, y1 - y + 1);
        m.rect(x0, y, 1, h).rect(x1, y, 1, h);
      }
      m.fill({ color: GROUP_PALETTE[gr.color], alpha: 0.8 });
    });
    for (const g of s.gnomes) {
      if (g.task?.plot === undefined || (g.task.kind !== 'harvest' && g.task.kind !== 'plant')) continue;
      const o = plotOrigin(s.plots[g.task.plot]);
      const x0 = o.x, y0 = o.y, x1 = o.x + FIELD.cell - 1, y1 = o.y + FIELD.cell - 1;
      const L = 4;
      for (const [x, y, w, h] of [
        [x0, y0, L, 1], [x0, y0, 1, L], [x1 - L + 1, y0, L, 1], [x1, y0, 1, L],
        [x0, y1, L, 1], [x0, y1 - L + 1, 1, L], [x1 - L + 1, y1, L, 1], [x1, y1 - L + 1, 1, L],
      ]) {
        m.rect(x, y, w, h);
      }
      m.fill({ color: GROUP_PALETTE[groupOf(s, g).color], alpha: 0.95 });
    }
  }

  private addParticle(texture: Texture, x: number, y: number, vx: number, vy: number, g: number, life: number, flutter?: number, tint?: number) {
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    if (tint !== undefined) sprite.tint = tint;
    this.fx.addChild(sprite);
    this.particles.push({ sprite, x, y, vx, vy, g, t: 0, life, flutter });
  }

  /** Atiende los eventos de la simulación y anima lo que dejan en pantalla (main.ts los vacía después). */
  private syncEvents(s: GameState, dt: number) {
    for (const e of s.events) {
      switch (e.type) {
        case 'coins':
          this.addFloat(`+${e.amount}`, e.x, e.y, '#ffcd75', 8);
          break;
        case 'golden':
          // cosecha dorada: corona de destellos y la cifra grande en oro
          for (let i = 0; i < 12; i++) {
            const ang = (i / 12) * Math.PI * 2;
            this.addParticle(this.atlas.sparkle, e.x, e.y, Math.cos(ang) * 30, Math.sin(ang) * 30 - 10, 20, 0.9);
          }
          this.addFloat(`+${e.amount}`, e.x, e.y - 6, '#fff3b0', 12);
          break;
        case 'harvest': {
          const sprite = new Sprite(this.atlas.items[e.crop]);
          sprite.anchor.set(0.5, 1);
          this.fx.addChild(sprite);
          this.flights.push({ sprite, x: e.x, y: e.y, gnome: e.gnome, t: 0 });
          break;
        }
        case 'deliver':
          this.doorT = DOOR_OPEN;
          this.pileCount = Math.min(16, this.pileCount + e.count);
          break;
        case 'moment':
          // efectos pequeños: polvo al tropezar, corazones al saludarse, destellos del legendario
          if (e.kind === 'tropiezo') {
            for (let i = 0; i < 5; i++) this.addParticle(this.atlas.dust, e.x + (i - 2) * 2, e.y - 1, (i - 2) * 10, -8 - Math.random() * 8, 40, 0.45);
          } else if (e.kind === 'saludo') {
            for (let i = 0; i < 2; i++) this.addParticle(this.atlas.heart, e.x - 3 + i * 6, e.y - 18 - i * 3, (i - 0.5) * 4, -10, 0, 0.9);
          } else if (e.kind === 'amistad') {
            // dos gnomos se hacen amigos: lluvia de corazones hacia arriba
            for (let i = 0; i < 8; i++) this.addParticle(this.atlas.heart, e.x - 8 + i * 2, e.y - 14 - (i % 3) * 3, (i - 3.5) * 6, -18 - (i % 2) * 6, 0, 1.4);
          } else if (e.kind === 'legendario') {
            for (let i = 0; i < 6; i++) {
              const ang = (i / 6) * Math.PI * 2;
              this.addParticle(this.atlas.sparkle, e.x, e.y - 10, Math.cos(ang) * 18, Math.sin(ang) * 18, 0, 0.7);
            }
          }
          break;
        case 'crown':
          break;
        case 'season':
          this.celebrate();
          break;
        case 'water': {
          // salpicadura: gotas que saltan de la planta y caen
          const o = plotOrigin(s.plots[e.plot]);
          for (let i = 0; i < 7; i++) this.addParticle(this.atlas.drop, o.x + 9 + (i - 3) * 1.5, o.y + 12, (i - 3) * 9, -22 - (i % 3) * 8, 140, 0.5);
          break;
        }
      }
    }

    for (const f of this.floats) {
      f.t += dt;
      f.text.alpha = Math.max(0, 1 - f.t / 1.2);
      const p = this.toScreen(f.x, f.y - f.t * 12);
      f.text.position.set(p.x, p.y);
    }
    const done = this.floats.filter(f => f.t > 1.2);
    for (const f of done) f.text.destroy();
    if (done.length) this.floats = this.floats.filter(f => f.t <= 1.2);

    // el cultivo hace un arco hasta la mano del gnomo (que puede estar moviéndose)
    for (const f of this.flights) {
      f.t += dt;
      const k = Math.min(1, f.t / FLIGHT_TIME);
      const g = s.gnomes.find(g => g.id === f.gnome);
      const tx = g ? g.x + (g.flip ? -4 : 4) : f.x;
      const ty = g ? g.y - 6 : f.y;
      f.sprite.position.set(Math.round(f.x + (tx - f.x) * k), Math.round(f.y + (ty - f.y) * k - Math.sin(k * Math.PI) * 10));
    }
    const landed = this.flights.filter(f => f.t >= FLIGHT_TIME);
    for (const f of landed) f.sprite.destroy();
    if (landed.length) this.flights = this.flights.filter(f => f.t < FLIGHT_TIME);

    for (const p of this.particles) {
      p.t += dt;
      p.vy += p.g * dt;
      if (p.flutter === undefined) {
        p.x += p.vx * dt;
        p.sprite.alpha = Math.max(0, 1 - p.t / p.life);
      } else {
        // el confeti se mece y da vueltas al caer
        p.x += p.vx * Math.cos(p.t * 3 + p.flutter) * dt;
        p.sprite.scale.x = Math.cos(p.t * 7 + p.flutter) > 0 ? 1 : -1;
        p.sprite.alpha = Math.min(1, (p.life - p.t) / 0.6);
      }
      p.y += p.vy * dt;
      p.sprite.position.set(Math.round(p.x), Math.round(p.y));
    }
    const gone = this.particles.filter(p => p.t >= p.life);
    for (const p of gone) p.sprite.destroy();
    if (gone.length) this.particles = this.particles.filter(p => p.t < p.life);
  }

  private addFloat(label: string, x: number, y: number, fill: string, size: number) {
    const text = new Text({
      text: label,
      style: { fontFamily: FONT, fontSize: size * this.scale, fontWeight: '600', fill, stroke: { color: '#1a1c2c', width: this.scale * 1.2 } },
    });
    text.anchor.set(0.5);
    this.overlay.addChild(text);
    this.floats.push({ text, x, y, t: 0 });
  }

  /** Puerta del granero abierta un momento tras cada entrega, y el montón que se va vaciando solo. */
  private syncBarnDoor(dt: number) {
    this.doorT = Math.max(0, this.doorT - dt);
    this.door.visible = this.doorT > 0;
    // entreabierta al abrirse y al cerrarse
    if (this.door.visible) this.door.texture = this.atlas.door[this.doorT > DOOR_OPEN - 0.08 || this.doorT < 0.08 ? 0 : 1];
    this.pileCount = Math.max(0, this.pileCount - dt * 0.3);
    const n = Math.ceil(this.pileCount);
    this.pile.texture = this.atlas.pile[n === 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 9 ? 3 : 4];
  }

  /** Lluvia de ranas: rayas cayendo sobre todo el huerto. */
  private syncRain(s: GameState) {
    const r = this.rain;
    r.clear();
    if (s.happening?.kind !== 'ranas') return;
    for (let i = 0; i < 28; i++) {
      const x = (i * 97 + Math.floor(i / 3) * 13) % WORLD.w;
      const y = ((this.time * 150 + i * 71) % (WORLD.h + 20)) - 10;
      r.rect(x, Math.round(y), 1, 4);
    }
    r.fill({ color: 0x94b0c2, alpha: 0.55 });
  }

  /** Flecha que bota sobre el gnomo seguido, por encima del bocadillo o la corona. */
  private syncMarker(s: GameState) {
    const g = this.followId === null ? undefined : s.gnomes.find(g => g.id === this.followId);
    const v = g && this.gnomes.get(g.id);
    this.marker.visible = !!v;
    if (!g || !v) return;
    const top = v.bubble.visible ? -26 : v.crown.visible ? -25 : -18;
    this.marker.position.set(Math.round(g.x), Math.round(g.y) + top - (Math.floor(this.time * 3) % 2));
  }

  private setHovered(lm: Landmark | null) {
    if (lm === this.hovered) return;
    if (this.hovered) {
      this.hovered.sprite.texture = this.hovered.normal;
      this.hovered.sprite.position.set(this.hovered.x, this.hovered.y);
    }
    this.hovered = lm;
    if (lm) {
      lm.sprite.texture = lm.hover;
      lm.sprite.position.set(lm.x - 1, lm.y - 1);
    }
  }

  private syncHover(s: GameState) {
    this.hover.clear();
    this.nameTag.visible = false;
    // con zum se puede arrastrar el huerto: la mano lo dice (agarrando mientras se arrastra)
    let cursor = this.drag?.moved ? 'grabbing' : this.zoomRange.zoomed && this.followId === null ? 'grab' : 'default';
    let lm: Landmark | null = null;
    const pt = this.pointer;
    if (pt) {
      // nombre del gnomo bajo el ratón (va antes que los edificios, que pueden estar detrás)
      const g = this.gnomeAt(s, pt.x, pt.y);
      lm = g ? null : this.landmarkAt(pt.x, pt.y);
      if (g) {
        const crowned = s.crowns[g.job] === g.id ? `\n${RANKING.corona(OFICIOS[g.job].nombre.toLowerCase())}` : '';
        // Pixelify Sans junta «fi» en una ligadura rara; el carácter invisible la rompe
        this.nameTag.text = `${g.name}\n${OFICIOS[g.job].nombre} · ${groupOf(s, g).name}${crowned}`.replace(/f(?=[il])/g, 'f\u200C');
        const p = this.toScreen(g.x, g.y - 18);
        this.nameTag.position.set(p.x, p.y);
        this.nameTag.visible = true;
        cursor = 'pointer';
      } else if (lm) {
        const label = lm.label ?? MENUS[lm.menu];
        this.nameTag.text = `${label.lugar}\n${label.sub}`;
        const p = this.toScreen(lm.x + lm.w / 2, lm.y - 2);
        this.nameTag.position.set(p.x, p.y);
        this.nameTag.visible = true;
        cursor = 'pointer';
      } else {
        const id = plotAt(s, pt.x, pt.y);
        const p = id !== null ? s.plots[id] : null;
        if (p && (p.stage === RIPE || p.stage === -1 || p.stage === ROTTEN)) {
          const o = plotOrigin(p);
          this.hover.rect(o.x + 0.5, o.y + 0.5, FIELD.cell - 1, FIELD.cell - 1).stroke({ width: 1, color: 0xf4f4f4, alpha: 0.5 });
          cursor = 'pointer';
        }
      }
    }
    this.setHovered(lm);
    if (this.drag?.moved) cursor = 'grabbing';
    if (this.app.canvas.style.cursor !== cursor) this.app.canvas.style.cursor = cursor;
  }
}

// Todos los textos del juego. Para retocar el tono, se cambia aquí.
import {
  BASKET, CARRETILLA_PER_LEVEL, CONSERVAS_PER_LEVEL, CROPS, GUARD, MERCADO_PER_LEVEL, PORTER_CAPACITY, TALENT_EFFECT, WATER,
} from './sim/config';
import type { Branch, CropId, JobId, NodeId, OrgPart, Priority, TalentId, TraitId } from './sim/types';

const pct = (f: number) => `${Math.round(f * 100)} %`;

export const UI = {
  titulo: 'Tiny Harvest',
  monedas: 'monedas',
  gnomos: 'gnomos',
  cerrar: 'Cerrar',
  vale: (n: number) => `vale ${n}`,
  semilla: 'Semilla',
  semillaAyuda: 'Lo que plantas al hacer clic en la tierra',
  bloqueadaEnArbol: 'Se desbloquea en el árbol de mejoras',
  tienes: (n: number) => `Tienes ${n}`,
  contratar: (n: number) => `Contratar · ${n}`,
  nivel: (n: number, max: number) => `Nivel ${n} de ${max}`,
  comprar: (n: number) => `Comprar · ${n}`,
  alMaximo: 'Al máximo',
  necesita: (padre: string) => `Necesita «${padre}»`,
  eligeNodo: 'Elige una rama del árbol para ver qué hace.',
  raiz: 'Huerto',
  raizDesc: 'De aquí sale todo. Las raíces no se compran: ya son tuyas.',
  bancalTam: (c: number, r: number) => `${c} × ${r}`,
  porViaje: (n: number) => `${n} cultivos por viaje`,
  masAguante: (p: number) => `lo maduro aguanta un ${p} % más`,
  masCaro: (p: number) => `todo se vende un ${p} % más caro`,
  riegoDura: (n: number) => `cada riego dura ${n} s`,
  vigilaA: (n: number) => `el guardián ve un bicho a ${n} pasos`,
  ahora: 'Ahora',
  borrar: 'Borrar partida',
  borrarSeguro: '¿Seguro? Pulsa otra vez',
  // próximo objetivo (G3) y sonido (G2)
  proximo: 'Próximo',
  proximoAyuda: 'Lo siguiente que puedes conseguir. Pulsa para abrir el árbol de mejoras.',
  proximoSemilla: (n: number) => (n === 1 ? 'La primera semilla dorada' : `Semilla dorada n.º ${n}`),
  proximoSemillaAyuda: 'El árbol está completo: cuanto más ganes esta temporada, más semillas doradas te llevarás. Pulsa para ver la estatua.',
  listo: '¡Ya puedes!',
  sonido: 'Sonido',
  sonidoOn: 'Quitar el sonido',
  sonidoOff: 'Poner el sonido',
  // arenga del capataz (G7)
  arenga: 'Arenga',
  arengaAyuda: (pct: number, s: number) => `El capataz anima a todos: un ${pct} % más rápido durante ${s} s.`,
  arengaActiva: (s: number) => `¡A tope! ${s} s`,
  arengaRecarga: (s: string) => `Se recarga en ${s}`,
  sinGnomos: 'Hace falta algún gnomo al que animar.',
};

/** Avisos de guardado y de errores: se quedan hasta que se resuelven. */
export const AVISOS = {
  ilegible: 'La partida guardada no se ha podido leer (está dañada o es de otra versión del juego). Se ha apartado una copia en este navegador y empiezas un huerto nuevo.',
  ilegibleSinCopia: 'La partida guardada no se ha podido leer y no queda sitio para apartar una copia. No se guardará nada encima hasta que la descargues o decidas sustituirla.',
  descargar: 'Descargar la partida dañada',
  sustituir: 'Empezar de nuevo y guardar encima',
  entendido: 'Entendido',
  sinGuardar: 'No se puede guardar la partida: el navegador no lo permite o no le queda sitio. Puedes seguir jugando, pero lo que hagas se perderá al cerrar. Se reintenta solo.',
  roto: 'Algo se ha roto y el huerto se ha detenido. La partida se guardó por última vez hace unos segundos; al recargar sigues desde ahí.',
  noArranca: 'El juego no ha podido arrancar. Prueba a recargar la página; si sigue sin funcionar, puede que tu navegador no sea compatible.',
  recargar: 'Recargar',
};

/** Menús y los elementos del huerto que los abren. */
export const MENUS = {
  contratar: { titulo: 'Granero', sub: 'Contratar gnomos', lugar: 'Granero', boton: 'Granero' },
  grupos: { titulo: 'Tablón de anuncios', sub: 'Grupos de gnomos', lugar: 'Tablón de anuncios', boton: 'Tablón' },
  arbol: { titulo: 'Árbol viejo', sub: 'Árbol de mejoras', lugar: 'Árbol viejo', boton: 'Árbol' },
  diario: { titulo: 'Diario del huerto', sub: 'Lo que ha pasado', lugar: 'Diario', boton: 'Diario' },
  ranking: { titulo: 'Gnomos del mes', sub: 'Quién destaca en el huerto', lugar: 'Ranking', boton: 'Ranking' },
  temporada: { titulo: 'Estatua del Gnomo Dorado', sub: 'Temporada y talentos', lugar: 'Estatua del Gnomo Dorado', boton: 'Estatua' },
  album: { titulo: 'Álbum del huerto', sub: 'Cromos de todas las temporadas', lugar: 'Álbum', boton: 'Álbum' },
} as const;
export type MenuId = keyof typeof MENUS;

export const OFICIOS: Record<JobId, { nombre: string; desc: string }> = {
  recolector: { nombre: 'Recolector', desc: 'Recoge lo que madura y lo lleva al granero. A veces, también lo que no.' },
  sembrador: { nombre: 'Sembrador', desc: 'Planta en las parcelas vacías, y arranca y vuelve a plantar las echadas a perder. Con una fe inquebrantable.' },
  porteador: { nombre: 'Porteador', desc: `Lleva la cosecha de la cesta al granero, de ${PORTER_CAPACITY} en ${PORTER_CAPACITY} (más con carretilla). Con porteadores, los recolectores dejan lo recogido en la cesta del bancal.` },
  regador: { nombre: 'Regador', desc: `Riega lo que crece: regado crece un ${pct(WATER.boost - 1)} más rápido durante ${WATER.duration} s. Los tomates y los melones, sin regar, casi ni se mueven. Lleva agua para ${WATER.can} riegos y vuelve al pozo a por más, silbando.` },
  guardian: { nombre: 'Guardián', desc: 'Patrulla alrededor del bancal y espanta cuervos y topos antes de que hagan de las suyas. Así los demás no dejan su trabajo. Se toma el cargo muy en serio.' },
};

export const CULTIVOS: Record<CropId, { nombre: string; uno: string; plural: string }> = {
  zanahoria: { nombre: 'Zanahoria', uno: 'una zanahoria', plural: 'zanahorias' },
  trigo: { nombre: 'Trigo', uno: 'un haz de trigo', plural: 'trigo' },
  tomate: { nombre: 'Tomate', uno: 'un tomate', plural: 'tomates' },
  calabaza: { nombre: 'Calabaza', uno: 'una calabaza', plural: 'calabazas' },
  fresa: { nombre: 'Fresa', uno: 'una fresa', plural: 'fresas' },
  melon: { nombre: 'Melón', uno: 'un melón', plural: 'melones' },
};

export function prioridad(p: Priority): string {
  if (p === 'cercano') return 'Lo más cercano primero';
  if (p === 'valioso') return 'Lo más valioso (según el paseo)';
  if (p === 'urgente') return 'Lo que se va a estropear antes';
  const crop = p.slice('solo_'.length) as CropId;
  return crop === 'trigo' ? 'Solo trigo' : `Solo ${CULTIVOS[crop].plural}`;
}

export const RAMAS: Record<Branch, string> = { gnomos: 'Gnomos', bancal: 'Bancal', cultivos: 'Cultivos' };

/** Descripción de las semillas sacada de CROPS, para que los números no se queden viejos. */
function semillaDesc(crop: CropId, cola: string): string {
  const c = CROPS[crop];
  const sed = c.thirsty ? ` Tiene sed: sin regar crece al ${pct(WATER.dry)} de su velocidad.` : '';
  if (crop === 'trigo') return `Permite plantar trigo: vale ${c.value}, tarda ${c.grow} s y aguanta ${c.keep} s maduro.${sed} ${cola}`;
  const maduros = crop === 'tomate' || crop === 'melon' ? 'maduros' : 'maduras';
  return `Permite plantar ${CULTIVOS[crop].plural}: valen ${c.value}, tardan ${c.grow} s y aguantan ${c.keep} s ${maduros}.${sed} ${cola}`;
}

export const ARBOL: Record<NodeId, { nombre: string; desc: string }> = {
  botas: { nombre: 'Botas con suela de corcho', desc: 'Los gnomos andan un 20 % más rápido por nivel.' },
  cafe: { nombre: 'Café de bellota', desc: 'Recogen y plantan un 18 % más rápido por nivel. Tiemblan un poco.' },
  saco: { nombre: 'Saco de tamaño familiar', desc: 'Los recolectores cargan un cultivo más por viaje.' },
  porteadores: { nombre: 'Gremio de porteadores', desc: 'Permite contratar porteadores en el granero. Llegan con carretilla propia y muchas opiniones.' },
  cesta: { nombre: 'Cesta de mimbre reforzado', desc: `La cesta del bancal guarda ${BASKET.perLevel} cultivos más por nivel.` },
  carretilla: { nombre: 'Carretilla con una rueda de más', desc: `Cada porteador se lleva ${CARRETILLA_PER_LEVEL} cultivos más por viaje y nivel. Nadie sabe para qué es la rueda de más, pero gira.` },
  bancal: { nombre: 'Ampliar el bancal', desc: 'Una columna o una fila más de tierra labrada.' },
  trigo: { nombre: 'Semillas de trigo', desc: semillaDesc('trigo', 'Más lento que la zanahoria, pero cada viaje cunde más.') },
  abono: { nombre: 'Abono de dudosa procedencia', desc: 'Los cultivos crecen un 15 % más rápido por nivel. Mejor no preguntar.' },
  tomate: { nombre: 'Semillas de tomate', desc: semillaDesc('tomate', 'Pocos viajes y buenas monedas, si alguien llega a tiempo.') },
  calabaza: { nombre: 'Semillas de calabaza', desc: semillaDesc('calabaza', 'Lentísima y cómoda: una siembra, una siesta larga y un viaje que vale la pena.') },
  conservas: { nombre: 'Cestos con paja', desc: `Lo maduro aguanta un ${pct(CONSERVAS_PER_LEVEL)} más por nivel antes de echarse a perder. La paja pica, pero no se queja nadie.` },
  mercado: { nombre: 'Puesto en el mercado', desc: `Todos los cultivos se venden un ${pct(MERCADO_PER_LEVEL)} más caros por nivel. Los gnomos regatean con mucho teatro.` },
  fresa: { nombre: 'Semillas de fresa', desc: semillaDesc('fresa', 'Rápida y rentable, pero se pocha en un suspiro: hace falta gente atenta (o paja).') },
  melon: { nombre: 'Semillas de melón', desc: semillaDesc('melon', 'Lo más valioso del huerto, si alguien se acuerda de regarlo.') },
  regadores: { nombre: 'Cofradía del Agua', desc: 'Permite contratar regadores en el granero y abre el pozo. Juran que el agua del pozo tiene propiedades. No las tiene.' },
  regadera: { nombre: 'Regadera con alcachofa fina', desc: `El riego dura un ${pct(WATER.regaderaTime)} más y se riega un ${pct(WATER.regaderaWork)} más rápido por nivel.` },
  guardianes: { nombre: 'Orden de la Atalaya', desc: 'Permite contratar guardianes en el granero. Vienen con torre propia y una mirada muy intensa.' },
  silbato: { nombre: 'Silbato de hojalata', desc: `El guardián ve ${GUARD.silbatoSight} pasos más lejos y anda un ${pct(GUARD.silbatoSpeed)} más rápido por nivel. Los cuervos lo odian.` },
};

/** Casa de gnomos: cada gnomo necesita una cama. Se gestiona desde el granero. */
export const CASA = {
  nombre: 'Casa de gnomos',
  desc: 'Cada gnomo necesita una cama. Sin camas libres no viene nadie, por mucho que pagues.',
  camas: (gnomos: number, camas: number) => `${gnomos} de ${camas} camas ocupadas`,
  ampliar: (coste: number) => `Ampliar · ${coste}`,
  lleno: 'No caben: amplía la casa',
  maximo: 'La casa no da para más: ya roza las nubes',
};

export const GRUPOS = {
  primero: 'Los de siempre',
  sugerencias: ['Los Madrugadores', 'La Brigada del Surco', 'Los Sin Prisa', 'Comando Zanahoria', 'Los del Fondo', 'La Peña del Rastrillo', 'Los Barbas', 'Los Siesteros', 'Escuadrón Tomate', 'Los Que Llegan Tarde'],
  ayuda: 'Cada grupo sigue su prioridad, siembra lo que le digas y trabaja en su zona del bancal. En el huerto, el aro bajo cada gnomo, la marca en la parcela a la que va y el borde de su zona tienen el color de su grupo. Arrastra un gnomo a otro grupo, o pulsa en él y luego en «Mover aquí».',
  nuevo: 'Nuevo grupo',
  nombre: 'Nombre del grupo',
  color: 'Color',
  prioridad: 'Prioridad',
  siembra: 'Siembran',
  siembraIgual: 'Lo mismo que había',
  vacio: 'Nadie todavía. Arrastra aquí algún gnomo.',
  moverAqui: 'Mover aquí',
  borrar: 'Borrar grupo',
  borrarSeguro: '¿Seguro?',
  nuevos: 'Aquí llegan los recién contratados',
  maximo: 'No caben más grupos',
  miembros: (n: number) => (n === 1 ? '1 gnomo' : `${n} gnomos`),
  bloqueado: 'sin desbloquear',
  zona: 'Zona',
  zonaTodo: 'Todo el bancal',
  zonaAyuda: 'Pulsa dos parcelas para marcar las esquinas de la zona. Recolectores, sembradores y regadores del grupo solo trabajan dentro; porteadores y guardianes van a todas partes.',
  zonaEsquina: 'Ahora pulsa la otra esquina',
  zonaDesc: (c0: number, c1: number, r0: number, r1: number) =>
    `${c0 === c1 ? `Columna ${c0 + 1}` : `Columnas ${c0 + 1}–${c1 + 1}`} · ${r0 === r1 ? `fila ${r0 + 1}` : `filas ${r0 + 1}–${r1 + 1}`}`,
  zonaCelda: (c: number, r: number) => `Parcela de la columna ${c + 1}, fila ${r + 1}`,
};

/** Ventana del ranking. Cada categoría muestra el podio de los gnomos actuales. */
export const RANKING = {
  ayuda: 'En cada oficio, el que más tareas lleva luce corona en el huerto. Para quitársela hay que sacarle ventaja. La corona es solo fama: no da ninguna ventaja.',
  corona: (oficio: string) => `Mejor ${oficio} del mes`,
  nadie: 'Nadie todavía.',
  perdidos: (n: number) => (n === 1 ? '1 cultivo echado a perder' : `${n} cultivos echados a perder`),
  aMano: (n: number) => (n === 1 ? 'Tú: 1 recogido a mano' : `Tú: ${n} recogidos a mano`),
  categorias: {
    tasks: { titulo: 'Los mejores de cada oficio', unidad: 'tareas; cada oficio compite con los suyos' },
    value: { titulo: 'El que más monedas genera', unidad: 'monedas cosechadas' },
    plants: { titulo: 'Mejor sembrador', unidad: 'siembras' },
    delivered: { titulo: 'El que más lleva al granero', unidad: 'cultivos' },
    walked: { titulo: 'El más andarín', unidad: 'pasos' },
    naps: { titulo: 'El más dormilón', unidad: 'siestas' },
    complaints: { titulo: 'El más quejica', unidad: 'quejas' },
  },
};

export const NOMBRES = ['Pepín', 'Tomasito', 'Gilberto', 'Remolacho', 'Anselmo', 'Fermín', 'Rufino', 'Baldomero', 'Eustaquio', 'Nicanor', 'Cosme', 'Telesforo', 'Casimiro', 'Leoncio', 'Hermenegildo', 'Pancracio'];
export const APELLIDOS = ['Barbatiesa', 'el Breve', 'Pocasprisas', 'Raíztorcida', 'Narizota', 'de la Acelga', 'Tresbotas', 'Sinsiesta', 'Gorrotuerto', 'Mediapapa', 'Terronillo', 'del Surco', 'Calabacín', 'Espigado'];

export const LOG = {
  inicio: 'El huerto abre. Los gnomos todavía no han llegado.',
  contratado: (n: string, oficio: string) => `${n} se une al huerto como ${oficio.toLowerCase()}. Ha traído su propia taza.`,
  siesta: ['se ha echado una siesta. Dice que es «estratégica».', 'se ha dormido de pie. Otra vez.', 'está «descansando la vista».'],
  plantar: ['ha plantado una semilla y le ha deseado suerte.', 'ha plantado una semilla al revés. Crecerá igual.', 'le ha puesto nombre a una semilla.'],
  protesta: (n: string) => `${n} protesta: «¿Quién ha decidido que esto lo lleve yo?»`,
  entrega: (n: string, que: string, monedas: number) => `${n} ha dejado ${que} en el granero. +${monedas} monedas.`,
  variosCultivos: (k: number) => `${k} cultivos`,
  cestaLlena: (n: string) => `${n} espera con el saco lleno: la cesta no da para más.`,
  manual: (uno: string) => `Has recogido ${uno} tú solo. Los gnomos aplauden sin muchas ganas.`,
  mejora: (nombre: string) => `Has comprado «${nombre}». Los gnomos fingen que les impresiona.`,
  desbloqueo: (plural: string) => `Ya se puede plantar ${plural}. Los gnomos ya se están quejando del peso.`,
  porteadores: 'El gremio de porteadores abre sus puertas. Exigen descanso los martes.',
  bancal: (c: number, r: number) => `El bancal crece a ${c} × ${r}. Los gnomos miran la tierra nueva con desconfianza.`,
  casa: (camas: number) => `La casa de gnomos crece: ya hay ${camas} camas. Discuten quién duerme arriba.`,
  cambioGrupo: (n: string, grupo: string) => `${n} se cambia a «${grupo}». Se despide de los demás con mucho drama.`,
  grupoNuevo: (g: string) => `Se funda «${g}». Nadie sabe muy bien para qué.`,
  grupoRenombrado: (a: string, b: string) => `«${a}» ahora se llama «${b}». Lo han votado a mano alzada.`,
  zona: (g: string, donde: string) => `«${g}» se queda con su trozo de bancal (${donde.toLowerCase()}). Han clavado un palito en cada esquina.`,
  zonaTodo: (g: string) => `«${g}» vuelve a trabajar en todo el bancal. Han arrancado los palitos.`,
  grupoBorrado: (a: string, b: string) => `«${a}» se disuelve. Sus miembros vuelven a «${b}» con la cabeza gacha.`,
  podrido: (uno: string) => `Se ha echado a perder ${uno}. Huele a reproche.`,
  dorada: (n: string, uno: string, monedas: number) => `¡Cosecha dorada! ${n} ha recogido ${uno} que brilla como el sol: +${monedas} monedas. Dice que ya lo sabía.`,
  doradaMano: (uno: string, monedas: number) => `¡Cosecha dorada! Has recogido ${uno} que brilla como el sol: +${monedas} monedas. Los gnomos se quitan el gorro.`,
  maestria: (plural: string, nivel: number, pct: number) => `Los gnomos ya dominan el cultivo de ${plural}: maestría ${nivel}, +${pct} % de valor. Se lo tienen muy creído.`,
  cromo: (pagina: string) => `Cromo nuevo en el álbum (${pagina.toLowerCase()}). Los gnomos lo pegan torcido.`,
  paginaAlbum: (pagina: string, semillas: number) => `¡Página «${pagina}» del álbum completa! +${semillas} ${semillas === 1 ? 'semilla dorada' : 'semillas doradas'}.`,
  arenga: [
    'El capataz se sube a una calabaza: «¡Por el huerto y por la merienda!». Los gnomos corren como si hubiera tarta.',
    'Arenga del capataz: «¡Quien acabe antes elige la siesta!». Hay estampida.',
    'El capataz toca el silbato tres veces. Nadie sabe qué significa, pero todos corren.',
  ],
  encargo: (quien: string, n: number, plural: string) => `Encargo: ${quien} quiere ${n} de ${plural}. Si llegan a tiempo, paga el doble.`,
  encargoCumplido: (quien: string, monedas: number) => `¡Encargo cumplido! ${quien} paga ${monedas} monedas y se va silbando.`,
  encargoPerdido: (quien: string) => `${quien} se cansa de esperar y se va. Volverá otro día, no pasa nada.`,
  encargoRechazado: (quien: string) => `Le decís a ${quien} que hoy no puede ser. Lo entiende perfectamente.`,
  arrancar: (n: string) => `${n} arranca una planta pocha y le da el pésame.`,
  primeraCorona: (n: string, oficio: string) => `${n} es el primer «mejor ${oficio} del mes». Nadie sabe quién decide esto, pero ya lleva corona.`,
  corona: (nuevo: string, viejo: string, oficio: string) => `${nuevo} le quita a ${viejo} la corona de mejor ${oficio}. Dice que no le importa, pero no se la quita ni para dormir.`,
  // vida en el huerto (iteración 6)
  legendario: (n: string) => `Ha llegado ${n}. Los demás gnomos se peinan la barba a toda prisa.`,
  comer: (n: string) => `${n} se ha comido una zanahoria «para comprobar que estaba buena». Lo estaba.`,
  pensar: (n: string) => `${n} se ha parado a pensar. No ha dicho en qué.`,
  disputa: (n: string) => `${n} llega a su parcela y alguien se le ha adelantado. Lo apunta en su libreta de rencores.`,
  tropiezo: (n: string) => `${n} se ha tropezado con sus propias botas. Asegura que la tierra se ha movido.`,
  charla: (a: string, b: string) => `${a} y ${b} se paran a comentar lo mucho que trabajan.`,
  cartas: (a: string, b: string) => `${a} y ${b} juegan a las cartas. Nadie se acuerda de las reglas.`,
  sentarse: (n: string) => `${n} se sienta en la hierba a ver crecer las cosas.`,
  mariposa: (n: string) => `${n} persigue una mariposa. La mariposa va ganando.`,
  cuervo: 'Un cuervo aterriza en el bancal y mira las cosechas con mucho interés.',
  cuervoCome: (uno: string) => `El cuervo se ha zampado ${uno} y se va sin pagar.`,
  cuervoFuera: (n: string) => `${n} espanta al cuervo agitando los brazos. El cuervo se ofende.`,
  caracol: 'Un caracol cruza el bancal. Lleva prisa, a su manera.',
  topo: 'Un topo asoma en el bancal, mira alrededor y decide quedarse un rato.',
  topoFuera: 'El topo se va por donde vino. Deja un agujero y ningún comentario.',
  ranas: 'Llueven ranas. Los gnomos lo encuentran normal para ser martes.',
  sindicato: 'El sindicato gnomo pide más café. Todos paran con los brazos cruzados.',
  sindicatoFin: 'Acaba la huelga: los gnomos vuelven al tajo con la taza en la mano.',
  espantapajaros: (n: string) => `${n} ha decidido que hoy es espantapájaros. Nadie se atreve a llevarle la contraria.`,
  // iteración 7
  regadores: 'Abre la Cofradía del Agua. El pozo ya tiene quien lo mire con cariño.',
  guardianes: 'La Orden de la Atalaya acepta miembros. Los cuervos empiezan a preocuparse.',
  regar: ['riega una tomatera y le dice que no tenga prisa.', 'ha regado una piedra. Por si acaso.', 'se ha regado los pies. Dice que también crecen.'],
  cuervoGuardian: (n: string) => `${n} ve venir al cuervo y lo echa antes de que pruebe bocado. Lo apunta en su cuaderno de guardia.`,
  topoGuardian: (n: string) => `${n} le pide educadamente al topo que se vaya. El topo se va, ofendidísimo.`,
  // iteración 8
  talento: (nombre: string) => `Has plantado «${nombre}» en el árbol dorado. Brilla un poco. Los gnomos hacen como que no lo ven.`,
  temporada: (n: number, semillas: number) =>
    `Empieza la temporada ${n}. Te llevas ${semillas === 1 ? '1 semilla dorada' : `${semillas} semillas doradas`} y un huerto recién barrido. La estatua del Gnomo Dorado parece más contenta.`,
  veterano: (n: string, temporadas: number) => (temporadas === 1
    ? `${n} vuelve del año pasado con la corona en la mochila. «¿Me habéis echado de menos?» Nadie contesta.`
    : `${n} vuelve por ${temporadas}.ª temporada. Ya tiene taza con su nombre y opiniones sobre todo.`),
  experiencia: (n: number) => `${n} gnomos con experiencia esperan en la puerta. No han cobrado nada: dicen que es por amor al surco.`,
};

/** Árbol dorado de talentos: se compra con semillas doradas y dura para siempre. */
export const TALENTOS: Record<TalentId, { nombre: string; desc: string }> = {
  abonoDorado: { nombre: 'Abono dorado', desc: `Los cultivos crecen un ${pct(TALENT_EFFECT.abonoDorado)} más rápido por nivel, y se suma al abono de siempre. Huele a gloria.` },
  semillasConocidas: { nombre: 'Semillas de la abuela', desc: `Cada temporada empieza con un cultivo más ya desbloqueado por nivel: trigo, fresa, tomate, calabaza y melón, por ese orden. Estaban en un bote debajo de la cama.` },
  bancalHeredado: { nombre: 'Tierra trabajada', desc: `Cada temporada empieza con el bancal ${TALENT_EFFECT.bancalHeredado === 1 ? 'una vez' : `${TALENT_EFFECT.bancalHeredado} veces`} más ampliado por nivel. Las lombrices se acuerdan del camino.` },
  herencia: { nombre: 'Hucha bajo la baldosa', desc: `Cada temporada empieza con ${TALENT_EFFECT.herencia} monedas por nivel. Nadie sabe quién las mete ahí.` },
  experiencia: { nombre: 'Gnomos con experiencia', desc: `Cada temporada llegan gratis ${TALENT_EFFECT.experiencia} recolector y ${TALENT_EFFECT.experiencia} sembrador por nivel. Ya saben dónde está el café.` },
  casaHeredada: { nombre: 'Casa con solera', desc: `Cada temporada empieza con la casa de gnomos ${TALENT_EFFECT.casaHeredada === 1 ? 'un nivel' : `${TALENT_EFFECT.casaHeredada} niveles`} más grande por nivel. Las literas ya vienen montadas.` },
  veterano: { nombre: 'Veteranos', desc: `Al acabar la temporada, ${TALENT_EFFECT.veterano === 1 ? 'el coronado que más ha trabajado vuelve' : `los ${TALENT_EFFECT.veterano} coronados que más han trabajado vuelven`} a la siguiente (uno más por nivel), con su nombre y su carácter. Y sus manías.` },
  mercadoDorado: { nombre: 'Mercado dorado', desc: `Todo se vende un ${pct(TALENT_EFFECT.mercadoDorado)} más caro por nivel. Los compradores no entienden por qué, pero pagan.` },
  contrato: { nombre: 'Contrato de por vida', desc: `Cada gnomo del mismo oficio encarece menos el siguiente: el precio sube ${Math.round(TALENT_EFFECT.contrato * 100)} puntos menos por nivel. La letra pequeña la escribió un gnomo.` },
  suerte: { nombre: 'Trébol de cuatro hojas', desc: `Un ${pct(TALENT_EFFECT.suerte)} más de probabilidad por nivel de que un gnomo nuevo sea legendario. El trébol lo encontró uno que no lo es.` },
};

/** Rasgos de carácter: se ven en la ficha del gnomo. */
export const RASGOS: Record<TraitId, { nombre: string; desc: string }> = {
  perezoso: { nombre: 'Perezoso', desc: 'Anda un poco más despacio y a veces se para a pensar. Dice que es filosofía.' },
  nervioso: { nombre: 'Nervioso', desc: 'Anda más rápido que nadie y tropieza más que nadie.' },
  gloton: { nombre: 'Glotón', desc: 'De vez en cuando se come una zanahoria recién recogida. Para probarla.' },
  cotilla: { nombre: 'Cotilla', desc: 'Se para a charlar con todo el que se cruza. Se sabe la vida de todos.' },
  dormilon: { nombre: 'Dormilón', desc: 'Echa más siestas, y más largas. Ronca en tres tonos.' },
  currante: { nombre: 'Currante', desc: 'Trabaja más rápido y casi nunca se sienta. Los demás lo miran raro.' },
};

/** Gnomo legendario: muy raro; gorro dorado y trabaja mejor. */
export const LEGENDARIO = {
  nombre: 'Legendario',
  desc: 'Un gnomo de leyenda: anda y trabaja un 25 % mejor. Nadie sabe de dónde ha salido.',
  titulos: ['el Magnífico', 'el Incansable', 'el de las Mil Cosechas', 'el Grande', 'el Deslumbrante', 'el Sabio del Surco'],
};

/** Álbum del huerto (G6): seis páginas de cromos. Lo que falta sale en silueta con una pista. */
export const ALBUM_TEXTOS = {
  ayuda: (semillas: number) => `Los cromos se quedan para siempre, temporada tras temporada. Cada página completa da ${semillas === 1 ? 'una semilla dorada' : `${semillas} semillas doradas`}.`,
  completa: '¡Página completa!',
  premio: (semillas: number) => `Completa la página: +${semillas} ${semillas === 1 ? 'semilla dorada' : 'semillas doradas'}`,
  falta: '???',
  paginas: {
    oficios: { titulo: 'Oficios', pista: 'Contrata a un gnomo de este oficio.' },
    rasgos: { titulo: 'Caracteres', pista: 'Contrata a un gnomo con este carácter.' },
    leyendas: { titulo: 'Leyendas', pista: 'Un gnomo legendario con este título. Muy, muy raro.' },
    sucesos: { titulo: 'Sucesos', pista: 'Algo que pasa en el huerto de vez en cuando. Hay que estar ahí.' },
    doradas: { titulo: 'Cosechas doradas', pista: 'Recoge una cosecha dorada de este cultivo.' },
    maestrias: { titulo: 'Maestrías', pista: 'Llega al nivel 3 de maestría con este cultivo en una temporada.' },
  },
  sucesos: {
    cuervo: 'El cuervo', caracol: 'El caracol', topo: 'El topo', ranas: 'Lluvia de ranas', sindicato: 'La huelga', espantapajaros: 'El espantapájaros',
  },
  maestria: (plural: string) => `Maestros de ${plural}`,
};

/** Encargos del pueblo (G8): quien los pide y la tarjeta que se ve sobre el huerto. */
export const ENCARGOS = {
  clientes: ['La abuela Remedios', 'El cartero Anselmo', 'La panadera Pura', 'El alcalde Ceferino', 'La maestra Rosario', 'El herrero Bonifacio'],
  titulo: 'Encargo',
  pide: (quien: string, n: number, plural: string) => `${quien} quiere ${n} de ${plural}`,
  paga: (monedas: number) => `Paga ${monedas} monedas`,
  no: 'Hoy no',
  noAyuda: 'Decir que no: se va sin más, no pasa nada.',
};

/** Maestría de cultivo (G5): se ve en los botones de semilla. */
export const MAESTRIA = {
  nivel: (n: number) => `Maestría ${n}`,
  progreso: (n: number, next: number) => `${n} / ${next} cosechas para el siguiente nivel`,
  maximo: 'maestría completa',
};

/** Ficha de un gnomo: se abre al pulsarlo en el huerto, en el tablón o en el ranking. */
export const FICHA = {
  titulo: (n: string) => `Ficha de ${n}`,
  cerrar: 'Cerrar la ficha',
  plegar: 'Plegar la ficha: solo el nombre y lo que hace',
  desplegar: 'Desplegar la ficha',
  ver: 'Ver ficha',
  verDe: (n: string) => `Ver la ficha de ${n}`,
  ayudaTablon: 'Doble clic en un gnomo para ver su ficha.',
  grupo: 'Grupo',
  rasgo: 'Carácter',
  ahora: 'Ahora',
  mover: 'Mover a…',
  frase: 'Frase del día',
  stats: {
    tasks: 'tareas',
    value: 'monedas',
    plants: 'siembras',
    delivered: 'entregas',
    walked: 'pasos',
    naps: 'siestas',
    complaints: 'quejas',
  },
  /** lo que está haciendo; `uno` es «un tomate», `otro` el nombre de pila del otro gnomo */
  haciendo: {
    vaARecoger: (uno: string) => `Va a por ${uno}`,
    recogiendo: (uno: string) => `Recogiendo ${uno} con mucho cuidado`,
    vaAPlantar: (uno: string) => `Va a plantar ${uno}`,
    plantando: (uno: string) => `Plantando ${uno}. Le está susurrando algo`,
    vaAlGranero: 'Lleva la cosecha al granero',
    entregando: 'Entregando en el granero',
    vaALaCesta: 'Lleva lo recogido a la cesta',
    cestaLlena: 'Esperando con el saco lleno: la cesta no da para más',
    vaAPorCesta: 'Va a por lo que haya en la cesta',
    paseando: 'Paseando sin rumbo fijo',
    silbando: 'Paseando y silbando bajito',
    descansando: 'Recuperando el aliento',
    siesta: 'Echando la siesta',
    queja: 'Quejándose a quien quiera oírle',
    sentado: 'Sentado, viendo crecer las zanahorias',
    cartas: (otro: string | null) => (otro ? `Jugando a las cartas con ${otro}` : 'Jugando a las cartas solo. Va perdiendo'),
    mariposa: 'Persiguiendo una mariposa',
    charla: (otro: string | null) => (otro ? `Charlando con ${otro}` : 'Charlando con una lechuga'),
    saludo: (otro: string | null) => (otro ? `Saludando a ${otro}` : 'Saludando a nadie en particular'),
    tropiezo: 'Levantándose del suelo con mucha dignidad',
    cuervo: 'Espantando a un cuervo',
    espantapajaros: 'Haciendo de espantapájaros. Muy convencido',
    huelga: 'En huelga: exige más siestas',
    aplaudiendo: 'Aplaudiendo algo con entusiasmo',
    pensando: 'Pensando. O eso dice',
    comiendo: 'Comiéndose una zanahoria «para probarla»',
    vaARegar: (uno: string) => `Va a regar ${uno}`,
    regando: (uno: string) => `Regando ${uno}. Le cuenta que va a llover`,
    regandoTierra: 'Regando la tierra, por si acaso',
    vaAlPozo: 'Va al pozo a por agua',
    llenando: 'Llenando la regadera. Sin prisa',
    patrullando: 'Patrullando el bancal con cara de importante',
    vigilando: 'Vigilando con la mano en la frente',
    haVisto: 'Ha visto algo. No le quita ojo',
    decidiendo: 'Decidiendo qué hacer con su vida',
  },
  /** frases del día: cambian cada minuto; las del rasgo se mezclan con las comunes */
  frases: [
    'Hoy siento que soy uno con el rastrillo.',
    'Una zanahoria me ha mirado raro.',
    'Si la tierra no se mueve, yo tampoco.',
    'He soñado con una calabaza que me debía dinero.',
    'La cesta y yo tenemos una relación complicada.',
    'No es barro. Es experiencia.',
    'Mi gorro es más alto que el tuyo. Que conste.',
    'Plantar es fácil. Lo difícil es esperar.',
    'Hoy no se me ha olvidado nada. Creo.',
    'Las lombrices me entienden.',
    'El trigo susurra cosas. No pienso repetirlas.',
    'Algún día tendré un huerto propio. Con sillón.',
    'Un tomate maduro es un tomate feliz.',
    'Me he encontrado una piedra preciosa. Era una piedra.',
    'Si el granero se llena, pediremos otro granero.',
    'Los martes huelen a abono.',
    'Nadie me ha dicho que no puedo hablar con las semillas.',
  ],
  frasesRasgo: {
    perezoso: ['Correr es para las nubes.', 'Estoy descansando por adelantado.', 'Mañana empiezo. Fijo.'],
    nervioso: ['¿Has oído eso? Yo sí. Creo.', 'Voy rápido porque la prisa me persigue.', 'Me he tropezado dos veces. Era la misma piedra.'],
    gloton: ['Esa zanahoria se ha caído sola en mi boca.', 'El hambre es un estado de ánimo.', 'Probar no es comer. Es control de calidad.'],
    cotilla: ['¿Te has enterado de lo de Anselmo? Yo tampoco, pero ya me enteraré.', 'Yo no cotilleo: informo.', 'Las paredes del granero oyen. Y yo con ellas.'],
    dormilon: ['Cinco minutitos más.', 'Duermo de pie para ahorrar tiempo.', 'He soñado que trabajaba. Qué cansancio.'],
    currante: ['¿Descanso? ¿Eso se come?', 'He plantado antes de que saliera el sol. El sol ha llegado tarde.', 'Si paro, me oxido.'],
  } satisfies Record<TraitId, string[]>,
};

/** Multiplicador de organización (B6): junto a las monedas; al pulsarlo se ve cómo va cada parte. */
export const ORG = {
  titulo: 'Organización',
  valor: (m: number) => `×${m.toFixed(2).replace('.', ',')}`,
  boton: 'Organización: lo bien que funciona el huerto. Multiplica lo que se cobra. Pulsa para ver el detalle',
  ayuda: 'Un huerto bien llevado vende más caro. Así va cada parte en los últimos minutos:',
  partes: {
    cosecha: 'Cosecha a tiempo',
    cesta: 'Cesta sin atascos',
    siembra: 'Tierra sembrada',
    riego: 'Riego de los sedientos',
  } satisfies Record<OrgPart, string>,
  /** pista para la parte que peor va */
  consejo: {
    cosecha: `Se echa a perder la cosecha: más recolectores o prioridad «${prioridad('urgente').toLowerCase()}».`,
    cesta: 'Los recolectores esperan con la cesta llena: más porteadores o una cesta más grande.',
    siembra: 'Hay tierra vacía mirando al cielo: más sembradores.',
    riego: 'Los cultivos con sed crecen a duras penas: hacen falta regadores (o más).',
  } satisfies Record<OrgPart, string>,
  todoBien: 'Todo marcha como un reloj de cuco. Los gnomos no se lo creen ni ellos.',
};

const semillas = (n: number) => (n === 1 ? '1 semilla dorada' : `${n} semillas doradas`);
const duracion = (seg: number) => {
  const min = Math.floor(seg / 60);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
};

/** Estatua del Gnomo Dorado: fin de temporada, árbol dorado de talentos y salón de la fama. */
export const TEMPORADA = {
  pestanas: { fin: 'Fin de temporada', arbol: 'Árbol dorado', fama: 'Salón de la fama' },
  temporada: (n: number) => `Temporada ${n}`,
  temporadaTitulo: 'Temporada',
  saldo: 'Semillas doradas para gastar en el árbol dorado',
  duracion,
  // fin de temporada
  jugado: 'Tiempo jugado',
  ganado: 'Monedas ganadas',
  tendrias: 'Semillas si terminas ya',
  rendimiento: 'Las semillas salen de lo que ganas en la temporada, pero cada una cuesta más que la anterior: exprimir el huerto da cada vez menos. Suele compensar más volver a empezar.',
  seQueda: 'Se queda',
  quedan: ['Las semillas doradas y los talentos', 'El salón de la fama', 'Los veteranos que te ganes'],
  sePierde: 'Se pierde',
  pierden: ['Las monedas', 'Los gnomos (salvo los veteranos)', 'Las mejoras del árbol viejo y la casa', 'Los grupos y lo plantado'],
  terminar: 'Terminar la temporada',
  terminarSeguro: '¿Seguro? Pulsa otra vez',
  noAun: (min: number, falta: number) =>
    `Aún no: los gnomos no aceptan un fin de temporada por menos de ${min === 1 ? 'una semilla' : `${min} semillas`}. Faltan ${falta} monedas por ganar.`,
  siguiente: (falta: number) => `La siguiente semilla, dentro de ${falta} monedas.`,
  // árbol dorado
  arbolAyuda: 'Los talentos duran para siempre. Se pagan con semillas doradas.',
  raiz: 'Gnomo Dorado',
  raizDesc: 'De aquí brotan los talentos. Dicen que la estatua guiña un ojo cuando nadie mira.',
  comprar: (n: number) => `Comprar · ${n} ${n === 1 ? 'semilla' : 'semillas'}`,
  /** «Ahora: …» de cada talento, con su nivel ya aplicado */
  efecto: {
    abonoDorado: (p: number) => `crece un ${p} % más rápido`,
    mercadoDorado: (p: number) => `todo se vende un ${p} % más caro`,
    herencia: (n: number) => `empiezas con ${n} monedas`,
    experiencia: (n: number) => `empiezas con ${n} ${n === 1 ? 'recolector y 1 sembrador' : `recolectores y ${n} sembradores`}`,
    contrato: (p: number) => `cada gnomo encarece el siguiente un ${p} %`,
    bancalHeredado: (n: number) => `empiezas con el bancal ampliado ${n === 1 ? '1 vez' : `${n} veces`}`,
    casaHeredada: (n: number) => `empiezas con la casa ampliada ${n === 1 ? '1 vez' : `${n} veces`}`,
    semillasConocidas: (cultivos: string) => `empiezas sabiendo plantar ${cultivos}`,
    veterano: (n: number) => (n === 1 ? 'vuelve 1 coronado' : `vuelven ${n} coronados`),
    suerte: (p: number) => `un ${String(p).replace('.', ',')} % de legendarios`,
  },
  // salón de la fama
  famaAyuda: 'Los coronados de cada temporada. La fama es para siempre; la barba, también.',
  famaVacia: 'Todavía no ha terminado ninguna temporada. El pedestal espera, reluciente y vacío.',
  sinCoronas: 'Nadie se ganó la corona. Fue una temporada tímida.',
  fila: (earned: number, seg: number, seeds: number) => `${earned} monedas · ${duracion(seg)} · ${semillas(seeds)}`,
  tareas: (n: number) => (n === 1 ? '1 tarea' : `${n} tareas`),
  veteranos: 'Veteranos',
  veteranosAyuda: 'Vuelven cada temporada con su nombre y sus manías.',
  temporadas: (n: number) => (n === 1 ? '1 temporada' : `${n} temporadas`),
  // resumen al terminar
  resumenTitulo: (n: number) => `Fin de la temporada ${n}`,
  resumenSemillas: (n: number) => `Has ganado ${semillas(n)}.`,
  resumenFama: 'Entran en el salón de la fama:',
  resumenVeteranos: 'Vuelven contigo:',
  resumenSigue: (n: number) => `Empieza la temporada ${n}. El huerto huele a nuevo.`,
  vamos: '¡A plantar!',
  verFama: 'Ver salón de la fama',
};

/** Tutorial (F5): unas pistas cortas, de una en una, que avanzan cuando el jugador hace lo que dicen. */
export const TUTORIAL = {
  plantar: 'Haz clic en la tierra para plantar y en lo maduro para recogerlo. Lo maduro no espera para siempre: si nadie lo recoge, se echa a perder.',
  contratar: 'Con unas monedas ya puedes contratar a tu primer gnomo en el granero. Cobra una vez y trabaja para siempre, aunque se queje.',
  arbol: 'El árbol viejo vende mejoras: más bancal, cultivos nuevos, oficios. Compra la primera.',
  grupos: 'En el tablón repartes a los gnomos en grupos, cada uno con su prioridad y la semilla que siembra.',
  ficha: 'Haz clic en un gnomo para ver su ficha y seguirlo con la cámara. Todos tienen algo que contar.',
  temporada: 'Ya puedes terminar la temporada en la estatua del Gnomo Dorado: semillas doradas a cambio de empezar de cero.',
  cerrar: 'Cerrar esta pista',
  noMas: 'No mostrar más',
};

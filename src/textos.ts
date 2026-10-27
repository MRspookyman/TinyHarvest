// Todos los textos del juego. Para retocar el tono, se cambia aquí.
import {
  BASKET, CARRETILLA_PER_LEVEL, CONSERVAS_PER_LEVEL, CROPS, GUARD, MERCADO_PER_LEVEL, PORTER_CAPACITY, WATER,
} from './sim/config';
import type { Branch, CropId, JobId, NodeId, OrgPart, Priority, TraitId } from './sim/types';

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
  pista: 'Haz clic en la tierra para plantar y en lo maduro para recogerlo. Lo maduro no espera para siempre: si nadie lo recoge, se echa a perder. El granero, la casa de gnomos, el tablón y el árbol viejo abren los menús. Haz clic en un gnomo para ver su ficha y seguirlo.',
};

/** Menús y los elementos del huerto que los abren. */
export const MENUS = {
  contratar: { titulo: 'Granero', sub: 'Contratar gnomos', lugar: 'Granero', boton: 'Granero' },
  grupos: { titulo: 'Tablón de anuncios', sub: 'Grupos de gnomos', lugar: 'Tablón de anuncios', boton: 'Tablón' },
  arbol: { titulo: 'Árbol viejo', sub: 'Árbol de mejoras', lugar: 'Árbol viejo', boton: 'Árbol' },
  diario: { titulo: 'Diario del huerto', sub: 'Lo que ha pasado', lugar: 'Diario', boton: 'Diario' },
  ranking: { titulo: 'Gnomos del mes', sub: 'Quién destaca en el huerto', lugar: 'Ranking', boton: 'Ranking' },
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
  ayuda: 'Cada grupo sigue su prioridad y siembra lo que le digas. En el huerto, el aro bajo cada gnomo y la marca en la parcela a la que va tienen el color de su grupo. Arrastra un gnomo a otro grupo, o pulsa en él y luego en «Mover aquí».',
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
  grupoBorrado: (a: string, b: string) => `«${a}» se disuelve. Sus miembros vuelven a «${b}» con la cabeza gacha.`,
  podrido: (uno: string) => `Se ha echado a perder ${uno}. Huele a reproche.`,
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

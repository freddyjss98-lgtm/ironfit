export const site = {
  url: "https://ironfitclub.vercel.app",
  brand: "Iron Fit Club",
  city: "Loja, Ecuador",
  country: "Ecuador",
  foundedDate: "30 · 08 · 2024",
  foundedISO: "2024-08-30",
  whatsappNumber: "593959888060",
  whatsappDisplay: "+593 959 888 060",
  instagramHandle: "@ironfitloh",
  instagramUrl: "https://instagram.com/ironfitloh",
  facebookName: "Iron Fit",
  facebookUrl: "https://facebook.com/",
  address:
    "Manuel Monteros & Antonio Peña Celi. Frente a la Facultad de Salud Humana de la UNL, Loja — Ecuador.",
  coords: {
    lat: -3.9931676,
    lng: -79.2083275,
    label: "-3.9932° S / -79.2083° W",
  },
  mapsUrl: "https://maps.app.goo.gl/GwvVreZcameDmppaA",
};

export const nav = {
  links: [
    { label: "Servicios", href: "#servicios" },
    { label: "Horarios", href: "#horarios" },
    { label: "Filosofía", href: "#filosofia" },
    { label: "Galería", href: "#galeria" },
    { label: "Ubicación", href: "#ubicacion" },
  ],
  cta: { label: "Empieza hoy", href: "#contacto" },
};

export const hero = {
  meta: ["Loja · Ecuador", "EST. 2024", "Funcional · Fuerza · Comunidad"],
  slogan:
    "Centro de acondicionamiento físico funcional. Disciplina, constancia y comunidad — entrenamientos diseñados para todos los niveles.",
  sloganHighlight: "Disciplina, constancia y comunidad",
  ctas: {
    primary: { label: "Agenda tu clase de prueba", href: "#contacto" },
    secondary: { label: "Ver servicios", href: "#servicios" },
  },
  image: { src: "/img/hero.jpg", alt: "Atleta entrenando en Iron Fit Club" },
};

export const marqueeItems = [
  "Disciplina",
  "Constancia",
  "Comunidad",
  "Superación",
  "Respeto",
  "Compromiso",
  "Funcional",
  "Fuerza",
];

export const stats = [
  { number: "9", sup: "+", label: "Disciplinas" },
  { number: "ALL", sup: "", label: "Niveles & edades" },
  { number: "6", sup: "d", label: "Días por semana" },
  { number: "24", sup: "/7", label: "Comunidad activa" },
];

export const servicios = [
  {
    title: "Entrenamiento funcional",
    desc: "Movimientos compuestos que entrenan tu cuerpo para la vida real.",
  },
  {
    title: "Musculación",
    desc: "Hipertrofia, fuerza y técnica con planes progresivos.",
  },
  {
    title: "Clases grupales",
    desc: "Ambiente motivador, intensidad escalable, comunidad real.",
  },
  {
    title: "Planes personalizados",
    desc: "Diseñados según tu objetivo, nivel y disponibilidad.",
  },
  {
    title: "Acondicionamiento físico",
    desc: "Capacidad cardiovascular, movilidad y resistencia muscular.",
  },
  {
    title: "Entrenamiento híbrido",
    desc: "Combina fuerza, funcional y conditioning en un solo plan.",
  },
  {
    title: "Control y seguimiento",
    desc: "Mediciones, evaluaciones y ajustes constantes a tu plan.",
  },
  {
    title: "Comunidad & trekking",
    desc: "Salidas, retos y experiencias fuera del gimnasio.",
  },
];

export const horarios = [
  { day: "Lun – Vie", am: "05:00 – 10:00", pm: "16:00 – 21:00" },
  { day: "Sábado", am: "08:00 – 10:00", pm: "—" },
  { day: "Domingo", am: "Cerrado · recupera y vuelve.", pm: "—" },
];

export const mvv = {
  mision: {
    heading: "Mejorar tu calidad de vida.",
    body: "Ayudar a las personas a mejorar su calidad de vida mediante entrenamiento funcional estructurado, promoviendo hábitos saludables, disciplina y bienestar físico y mental.",
  },
  vision: {
    heading: "Referente en Loja.",
    body: "Ser un referente en entrenamiento funcional y acondicionamiento físico en Loja, creando una comunidad fuerte, saludable y motivada.",
  },
  valores: [
    "Disciplina",
    "Constancia",
    "Comunidad",
    "Respeto",
    "Superación",
    "Compromiso",
  ],
};

export const gallery: {
  src: string;
  alt: string;
  aspect: "3/4" | "3/5" | "4/3";
  width: number;
}[] = [
  { src: "/img/gallery-1.jpg", alt: "Iron Fit Club", aspect: "3/4", width: 380 },
  { src: "/img/gallery-2.jpg", alt: "Iron Fit Club", aspect: "4/3", width: 520 },
  { src: "/img/gallery-3.jpg", alt: "Iron Fit Club", aspect: "3/5", width: 340 },
  { src: "/img/gallery-4.jpg", alt: "Iron Fit Club", aspect: "3/4", width: 420 },
  { src: "/img/gallery-5.jpg", alt: "Iron Fit Club", aspect: "4/3", width: 560 },
  { src: "/img/gallery-6.jpg", alt: "Iron Fit Club", aspect: "3/4", width: 380 },
  { src: "/img/gallery-7.jpg", alt: "Iron Fit Club", aspect: "3/5", width: 360 },
];

export const contacto = {
  title: "Nunca se está verdaderamente listo.",
  subtitle: "Solo hay que empezar.",
  goalOptions: [
    "Funcional",
    "Musculación",
    "Clases grupales",
    "Plan personalizado",
    "Aún no lo sé",
  ],
};

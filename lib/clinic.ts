// Clinic catalogue: a fictional practice used as a portfolio concept.
// Everything time-related is expressed in the clinic's own time zone.

export const CLINIC = {
  name: "Mira Dental Studio",
  timeZone: "Asia/Beirut",
  phone: "+961 1 000 000",
  email: "hello@miradental.example",
  address: {
    en: "Mira Building, 3rd floor, Armenia Street, Mar Mikhael, Beirut",
    ar: "مبنى ميرا، الطابق الثالث، شارع أرمينيا، مار مخايل، بيروت",
    fr: "Immeuble Mira, 3e étage, rue d'Arménie, Mar Mikhaël, Beyrouth",
  },
  /** How far ahead patients can book, in days. */
  bookingWindowDays: 30,
  /** Minimum notice before an appointment, in minutes. */
  minNoticeMinutes: 60,
  /** Slot grid step, in minutes. */
  slotStep: 15,
} as const;

export type Locale = "en" | "ar" | "fr";
type L10n = Record<Locale, string>;

/** Opening hours per weekday (0 = Sunday). null = closed. "HH:mm" in clinic time. */
export const OPENING_HOURS: Record<number, { open: string; close: string } | null> = {
  0: null,
  1: { open: "09:00", close: "18:00" },
  2: { open: "09:00", close: "18:00" },
  3: { open: "09:00", close: "18:00" },
  4: { open: "09:00", close: "18:00" },
  5: { open: "09:00", close: "18:00" },
  6: { open: "09:00", close: "14:00" },
};

export type Service = {
  id: string;
  duration: number; // minutes
  priceUsd: number; // 0 = free
  name: L10n;
  description: L10n;
  icon: "tooth" | "sparkle" | "shield" | "brace" | "root" | "child" | "implant";
};

export const SERVICES: Service[] = [
  {
    id: "checkup",
    duration: 45,
    priceUsd: 40,
    icon: "tooth",
    name: { en: "Check-up & cleaning", ar: "فحص وتنظيف", fr: "Contrôle et détartrage" },
    description: {
      en: "Full examination, scaling and polishing, with a personalised care plan.",
      ar: "فحص شامل وإزالة الجير والتلميع مع خطة عناية خاصة بك.",
      fr: "Examen complet, détartrage et polissage, avec un plan de soins personnalisé.",
    },
  },
  {
    id: "whitening",
    duration: 60,
    priceUsd: 180,
    icon: "sparkle",
    name: { en: "Teeth whitening", ar: "تبييض الأسنان", fr: "Blanchiment dentaire" },
    description: {
      en: "In-clinic whitening session for a brighter smile in about an hour.",
      ar: "جلسة تبييض في العيادة لابتسامة أكثر إشراقًا خلال ساعة تقريبًا.",
      fr: "Séance de blanchiment au cabinet pour un sourire plus éclatant en une heure.",
    },
  },
  {
    id: "filling",
    duration: 45,
    priceUsd: 60,
    icon: "shield",
    name: { en: "Tooth-coloured filling", ar: "حشوة بلون السن", fr: "Obturation esthétique" },
    description: {
      en: "Composite fillings that match your natural tooth colour.",
      ar: "حشوات تجميلية تطابق لون أسنانك الطبيعي.",
      fr: "Obturations en composite assorties à la teinte naturelle de vos dents.",
    },
  },
  {
    id: "root-canal",
    duration: 90,
    priceUsd: 220,
    icon: "root",
    name: { en: "Root canal treatment", ar: "علاج العصب", fr: "Traitement de canal" },
    description: {
      en: "Gentle endodontic treatment to save an infected or painful tooth.",
      ar: "علاج لطيف للعصب لإنقاذ السن الملتهب أو المؤلم.",
      fr: "Traitement endodontique en douceur pour sauver une dent infectée ou douloureuse.",
    },
  },
  {
    id: "ortho-consult",
    duration: 30,
    priceUsd: 0,
    icon: "brace",
    name: { en: "Braces & aligners consultation", ar: "استشارة تقويم الأسنان", fr: "Consultation orthodontique" },
    description: {
      en: "Free assessment for braces or clear aligners, with a treatment estimate.",
      ar: "تقييم مجاني للتقويم المعدني أو الشفاف مع تقدير للعلاج.",
      fr: "Bilan gratuit pour appareil ou aligneurs transparents, avec estimation du traitement.",
    },
  },
  {
    id: "kids",
    duration: 30,
    priceUsd: 30,
    icon: "child",
    name: { en: "Children's check-up", ar: "فحص الأطفال", fr: "Contrôle enfant" },
    description: {
      en: "A calm, friendly first visit for children aged 3 to 12.",
      ar: "زيارة أولى هادئة ولطيفة للأطفال من ٣ إلى ١٢ سنة.",
      fr: "Une première visite douce et rassurante pour les enfants de 3 à 12 ans.",
    },
  },
  {
    id: "implant-consult",
    duration: 30,
    priceUsd: 25,
    icon: "implant",
    name: { en: "Implant consultation", ar: "استشارة زراعة الأسنان", fr: "Consultation implantologie" },
    description: {
      en: "Assessment and 3D planning for dental implants.",
      ar: "تقييم وتخطيط ثلاثي الأبعاد لزراعة الأسنان.",
      fr: "Bilan et planification 3D pour la pose d'implants.",
    },
  },
];

export type Dentist = {
  id: string;
  name: string;
  initials: string;
  hue: number; // avatar colour
  role: L10n;
  bio: L10n;
  languages: string[];
  services: string[]; // service ids
  days: number[]; // weekdays they work
};

export const DENTISTS: Dentist[] = [
  {
    id: "lea",
    name: "Dr. Léa Haddad",
    initials: "LH",
    hue: 172,
    role: { en: "General & cosmetic dentist", ar: "طبيبة أسنان عامة وتجميلية", fr: "Dentiste généraliste et esthétique" },
    bio: {
      en: "Focuses on preventive care and natural-looking cosmetic work.",
      ar: "تركّز على الطب الوقائي والتجميل بمظهر طبيعي.",
      fr: "Spécialisée en prévention et en esthétique au rendu naturel.",
    },
    languages: ["English", "العربية", "Français"],
    services: ["checkup", "whitening", "filling", "kids"],
    days: [1, 2, 3, 4, 5, 6],
  },
  {
    id: "karim",
    name: "Dr. Karim Saade",
    initials: "KS",
    hue: 214,
    role: { en: "Orthodontist", ar: "أخصائي تقويم الأسنان", fr: "Orthodontiste" },
    bio: {
      en: "Braces and clear aligners for teens and adults.",
      ar: "تقويم معدني وشفاف للمراهقين والبالغين.",
      fr: "Appareils et aligneurs transparents pour adolescents et adultes.",
    },
    languages: ["English", "العربية"],
    services: ["ortho-consult", "checkup"],
    days: [1, 3, 5],
  },
  {
    id: "rania",
    name: "Dr. Rania Aoun",
    initials: "RA",
    hue: 330,
    role: { en: "Endodontist & implantologist", ar: "أخصائية علاج العصب وزراعة الأسنان", fr: "Endodontiste et implantologue" },
    bio: {
      en: "Root canal treatment and implant planning with modern imaging.",
      ar: "علاج العصب وتخطيط الزراعة بأحدث تقنيات التصوير.",
      fr: "Traitements de canal et planification implantaire avec imagerie moderne.",
    },
    languages: ["English", "العربية", "Français"],
    services: ["root-canal", "implant-consult", "filling"],
    days: [2, 4, 6],
  },
];

export const getService = (id: string) => SERVICES.find((s) => s.id === id);
export const getDentist = (id: string) => DENTISTS.find((d) => d.id === id);
export const dentistsFor = (serviceId: string) => DENTISTS.filter((d) => d.services.includes(serviceId));

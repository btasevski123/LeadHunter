export enum Industry {
  PRINTING = 'PRINTING',
  MANUFACTURING = 'MANUFACTURING',
  FACTORIES = 'FACTORIES',
  CONSTRUCTION = 'CONSTRUCTION',
  FURNITURE = 'FURNITURE',
  METAL_INDUSTRY = 'METAL_INDUSTRY',
  AUTOMOTIVE = 'AUTOMOTIVE',
  DENTAL = 'DENTAL',
  HEALTHCARE = 'HEALTHCARE',
  LEGAL = 'LEGAL',
  ACCOUNTING = 'ACCOUNTING',
  TOURISM = 'TOURISM',
  /** @deprecated Prefer FOOD_BEVERAGE + LODGING — kept for existing DB rows */
  HOSPITALITY = 'HOSPITALITY',
  FOOD_BEVERAGE = 'FOOD_BEVERAGE',
  LODGING = 'LODGING',
  FITNESS = 'FITNESS',
  RETAIL = 'RETAIL',
  SERVICES = 'SERVICES',
}

export const INDUSTRY_LABELS: Record<Industry, string> = {
  [Industry.PRINTING]: 'Printing',
  [Industry.MANUFACTURING]: 'Manufacturing',
  [Industry.FACTORIES]: 'Factories',
  [Industry.CONSTRUCTION]: 'Construction',
  [Industry.FURNITURE]: 'Furniture',
  [Industry.METAL_INDUSTRY]: 'Metal Industry',
  [Industry.AUTOMOTIVE]: 'Automotive',
  [Industry.DENTAL]: 'Стоматологија',
  [Industry.HEALTHCARE]: 'ПЗУ / приватни лекари',
  [Industry.LEGAL]: 'Legal',
  [Industry.ACCOUNTING]: 'Accounting',
  [Industry.TOURISM]: 'Tourism',
  [Industry.HOSPITALITY]: 'Hospitality (legacy)',
  [Industry.FOOD_BEVERAGE]: 'Ресторани и храна',
  [Industry.LODGING]: 'Хотели / сместување',
  [Industry.FITNESS]: 'Фитнес / теретани',
  [Industry.RETAIL]: 'Retail',
  [Industry.SERVICES]: 'Services',
};

export type IndustryGroupId =
  | 'PRODUCTION'
  | 'HEALTH'
  | 'FOOD_LODGING'
  | 'SPORT'
  | 'PROFESSIONAL'
  | 'LOCAL'
  | 'OTHER';

export const INDUSTRY_GROUP_LABELS: Record<IndustryGroupId, string> = {
  PRODUCTION: 'Индустрија / производство',
  HEALTH: 'Здравство',
  FOOD_LODGING: 'Храна и угостителство',
  SPORT: 'Спорт / wellness',
  PROFESSIONAL: 'Професионални услуги',
  LOCAL: 'Локален бизнис',
  OTHER: 'Друго',
};

/** Canonical UI ordering — HOSPITALITY omitted from discovery (legacy filter only). */
export const INDUSTRY_GROUPS: Array<{
  id: IndustryGroupId;
  label: string;
  industries: Industry[];
}> = [
  {
    id: 'PRODUCTION',
    label: INDUSTRY_GROUP_LABELS.PRODUCTION,
    industries: [
      Industry.PRINTING,
      Industry.MANUFACTURING,
      Industry.FACTORIES,
      Industry.CONSTRUCTION,
      Industry.FURNITURE,
      Industry.METAL_INDUSTRY,
      Industry.AUTOMOTIVE,
    ],
  },
  {
    id: 'HEALTH',
    label: INDUSTRY_GROUP_LABELS.HEALTH,
    industries: [Industry.HEALTHCARE, Industry.DENTAL],
  },
  {
    id: 'FOOD_LODGING',
    label: INDUSTRY_GROUP_LABELS.FOOD_LODGING,
    industries: [Industry.FOOD_BEVERAGE, Industry.LODGING],
  },
  {
    id: 'SPORT',
    label: INDUSTRY_GROUP_LABELS.SPORT,
    industries: [Industry.FITNESS],
  },
  {
    id: 'PROFESSIONAL',
    label: INDUSTRY_GROUP_LABELS.PROFESSIONAL,
    industries: [Industry.LEGAL, Industry.ACCOUNTING, Industry.SERVICES],
  },
  {
    id: 'LOCAL',
    label: INDUSTRY_GROUP_LABELS.LOCAL,
    industries: [Industry.TOURISM, Industry.RETAIL],
  },
];

/** Flat list for discovery selects (excludes legacy HOSPITALITY). */
export const DISCOVERY_INDUSTRIES: Industry[] = INDUSTRY_GROUPS.flatMap((g) => g.industries);

export const INDUSTRY_TO_GROUP: Record<Industry, IndustryGroupId> = {
  [Industry.PRINTING]: 'PRODUCTION',
  [Industry.MANUFACTURING]: 'PRODUCTION',
  [Industry.FACTORIES]: 'PRODUCTION',
  [Industry.CONSTRUCTION]: 'PRODUCTION',
  [Industry.FURNITURE]: 'PRODUCTION',
  [Industry.METAL_INDUSTRY]: 'PRODUCTION',
  [Industry.AUTOMOTIVE]: 'PRODUCTION',
  [Industry.DENTAL]: 'HEALTH',
  [Industry.HEALTHCARE]: 'HEALTH',
  [Industry.LEGAL]: 'PROFESSIONAL',
  [Industry.ACCOUNTING]: 'PROFESSIONAL',
  [Industry.TOURISM]: 'LOCAL',
  [Industry.HOSPITALITY]: 'FOOD_LODGING',
  [Industry.FOOD_BEVERAGE]: 'FOOD_LODGING',
  [Industry.LODGING]: 'FOOD_LODGING',
  [Industry.FITNESS]: 'SPORT',
  [Industry.RETAIL]: 'LOCAL',
  [Industry.SERVICES]: 'PROFESSIONAL',
};

export const INDUSTRY_VALUES = Object.values(Industry);

export const COMPANY_SOURCES = {
  CENTRAL_REGISTRY: 'CENTRAL_REGISTRY',
  COMPANY_WALL: 'COMPANY_WALL',
  BIZNIS_MREZA: 'BIZNIS_MREZA',
  YELLOW_PAGES: 'YELLOW_PAGES',
  GOOGLE_DISCOVERY: 'GOOGLE_DISCOVERY',
  GOOGLE_MAPS: 'GOOGLE_MAPS',
  INDUSTRY_DIRECTORY: 'INDUSTRY_DIRECTORY',
  BUSINESS_DIRECTORY: 'BUSINESS_DIRECTORY',
} as const;

export type CompanySourceName = (typeof COMPANY_SOURCES)[keyof typeof COMPANY_SOURCES];

export const INDUSTRY_SEARCH_TERMS: Record<Industry, string[]> = {
  [Industry.PRINTING]: ['печатница', 'печатење', 'графичка', 'дигитална печатница'],
  [Industry.MANUFACTURING]: ['производство', 'производител', 'производствен погон'],
  [Industry.FACTORIES]: ['фабрика', 'фабрики', 'индустриски погон'],
  [Industry.CONSTRUCTION]: ['градежна', 'градежништво', 'градежна фирма', 'изведувач'],
  [Industry.FURNITURE]: ['мебел', 'производство мебел', 'мебел салон'],
  [Industry.METAL_INDUSTRY]: ['метална индустрија', 'металопреработка', 'челик', 'железара'],
  [Industry.AUTOMOTIVE]: ['авто сервис', 'автосервис', 'автоперална'],
  [Industry.DENTAL]: [
    'стоматолошка',
    'стоматологија',
    'стоматолог',
    'пзу стоматологија',
    'дентална ординација',
  ],
  [Industry.HEALTHCARE]: [
    'пзу',
    'приватна здравствена установа',
    'приватна ординација',
    'приватен лекар',
    'ординација',
    'клиника',
    'специјалист',
  ],
  [Industry.LEGAL]: ['адвокат', 'адвокати', 'адвокатска канцеларија'],
  [Industry.ACCOUNTING]: ['сметководство', 'сметководствена', 'сметководител', 'книговодство'],
  [Industry.TOURISM]: ['туризам', 'туристичка агенција', 'тура оператор'],
  [Industry.HOSPITALITY]: ['хотел', 'ресторан'],
  [Industry.FOOD_BEVERAGE]: [
    'ресторан',
    'кафеана',
    'пицерија',
    'брза храна',
    'кафе бар',
    'пекара',
    'слаткарница',
    'угостителство',
    'гостилница',
    'бар',
  ],
  [Industry.LODGING]: ['хотел', 'апартман', 'пансион', 'сместување', 'хостел'],
  [Industry.FITNESS]: [
    'теретана',
    'фитнес',
    'фитнес центар',
    'фитнес клуб',
    'кросфит',
    'јога студио',
  ],
  [Industry.RETAIL]: ['трговија', 'продавница', 'маркет', 'бутик'],
  [Industry.SERVICES]: ['услуги', 'сервис', 'фризер', 'козметички салон'],
};

/** When scraping legacy HOSPITALITY, expand to the split verticals. */
export function expandIndustryFilter(industry: Industry): Industry[] {
  if (industry === Industry.HOSPITALITY) {
    return [Industry.FOOD_BEVERAGE, Industry.LODGING, Industry.HOSPITALITY];
  }
  return [industry];
}

export function parseIndustry(value?: string | null): Industry | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase().replace(/\s+/g, '_');
  if ((INDUSTRY_VALUES as string[]).includes(upper)) return upper as Industry;
  const lower = value.trim().toLowerCase();
  for (const [key, label] of Object.entries(INDUSTRY_LABELS)) {
    if (label.toLowerCase() === lower) return key as Industry;
  }
  // Common aliases
  if (lower === 'hospitality') return Industry.HOSPITALITY;
  if (lower === 'dental') return Industry.DENTAL;
  if (lower.includes('пзу') || lower === 'healthcare' || lower === 'medical') {
    return Industry.HEALTHCARE;
  }
  if (lower === 'fitness' || lower.includes('теретана') || lower.includes('фитнес')) {
    return Industry.FITNESS;
  }
  if (lower.includes('ресторан') || lower === 'food' || lower === 'food_beverage') {
    return Industry.FOOD_BEVERAGE;
  }
  if (lower.includes('хотел') || lower === 'lodging') return Industry.LODGING;
  return null;
}

export function industryLabel(industry?: string | null): string {
  if (!industry) return 'Other';
  const parsed = parseIndustry(industry);
  if (parsed) return INDUSTRY_LABELS[parsed];
  return industry;
}

export function industryGroupLabel(industry?: string | null): string {
  const parsed = parseIndustry(industry);
  if (!parsed) return INDUSTRY_GROUP_LABELS.OTHER;
  return INDUSTRY_GROUP_LABELS[INDUSTRY_TO_GROUP[parsed]];
}

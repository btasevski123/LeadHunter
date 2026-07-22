export enum Industry {
  PRINTING = 'PRINTING',
  MANUFACTURING = 'MANUFACTURING',
  FACTORIES = 'FACTORIES',
  CONSTRUCTION = 'CONSTRUCTION',
  FURNITURE = 'FURNITURE',
  METAL_INDUSTRY = 'METAL_INDUSTRY',
  AUTOMOTIVE = 'AUTOMOTIVE',
  DENTAL = 'DENTAL',
  LEGAL = 'LEGAL',
  ACCOUNTING = 'ACCOUNTING',
  TOURISM = 'TOURISM',
  HOSPITALITY = 'HOSPITALITY',
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
  [Industry.DENTAL]: 'Dental',
  [Industry.LEGAL]: 'Legal',
  [Industry.ACCOUNTING]: 'Accounting',
  [Industry.TOURISM]: 'Tourism',
  [Industry.HOSPITALITY]: 'Hospitality',
  [Industry.RETAIL]: 'Retail',
  [Industry.SERVICES]: 'Services',
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
  [Industry.PRINTING]: ['печатница', 'печатење', 'графичка'],
  [Industry.MANUFACTURING]: ['производство', 'производител'],
  [Industry.FACTORIES]: ['фабрика', 'фабрики'],
  [Industry.CONSTRUCTION]: ['градежна', 'градежништво', 'градежна фирма'],
  [Industry.FURNITURE]: ['мебел', 'производство мебел'],
  [Industry.METAL_INDUSTRY]: ['метална индустрија', 'металопреработка'],
  [Industry.AUTOMOTIVE]: ['авто сервис', 'автосервис'],
  [Industry.DENTAL]: ['стоматолошка', 'стоматологија'],
  [Industry.LEGAL]: ['адвокат', 'адвокати'],
  [Industry.ACCOUNTING]: ['сметководство', 'сметководствена'],
  [Industry.TOURISM]: ['туризам', 'туристичка агенција'],
  [Industry.HOSPITALITY]: ['хотел', 'ресторан'],
  [Industry.RETAIL]: ['трговија', 'продавница'],
  [Industry.SERVICES]: ['услуги', 'сервис'],
};

export function parseIndustry(value?: string | null): Industry | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase().replace(/\s+/g, '_');
  if ((INDUSTRY_VALUES as string[]).includes(upper)) return upper as Industry;
  const lower = value.trim().toLowerCase();
  for (const [key, label] of Object.entries(INDUSTRY_LABELS)) {
    if (label.toLowerCase() === lower) return key as Industry;
  }
  return null;
}

export function industryLabel(industry?: string | null): string {
  if (!industry) return 'Other';
  const parsed = parseIndustry(industry);
  if (parsed) return INDUSTRY_LABELS[parsed];
  return industry;
}

import { Industry, INDUSTRY_LABELS, INDUSTRY_VALUES } from './industry';
import { MK_CITY_OPTIONS } from './cities';

/** @deprecated Prefer MK_CITY_OPTIONS — Latin-only values don't match Cyrillic DB cities */
export const MK_CITIES = [
  'Skopje',
  'Bitola',
  'Kumanovo',
  'Prilep',
  'Tetovo',
  'Veles',
  'Štip',
  'Ohrid',
  'Gostivar',
  'Strumica',
  'Kavadarci',
  'Kočani',
  'Kičevo',
  'Struga',
  'Radoviš',
  'Gevgelija',
  'Debar',
  'Kriva Palanka',
  'Sveti Nikole',
  'Negotino',
  'Delčevo',
  'Vinica',
  'Resen',
  'Probištip',
  'Berovo',
] as const;

export { MK_CITY_OPTIONS };

/** Canonical industry filter values used by dashboard + scrapers */
export const INDUSTRIES = INDUSTRY_VALUES;

/** Human-readable industry labels for UI selects */
export const INDUSTRY_OPTIONS = INDUSTRY_VALUES.map((value) => ({
  value,
  label: INDUSTRY_LABELS[value],
}));

export { Industry, INDUSTRY_LABELS };

export const OUTREACH_STATUSES = [
  'NOT_CONTACTED',
  'CONTACTED',
  'REPLIED',
  'MEETING_SCHEDULED',
  'WON',
  'LOST',
] as const;

export const BUSINESS_EMAIL_PREFIXES = [
  'info',
  'contact',
  'office',
  'sales',
  'hello',
  'admin',
  'support',
  'marketing',
  'kontakt',
  'firma',
] as const;

export const HIGH_VALUE_SCORE_THRESHOLD = 70;

export const DEFAULT_PAGE_SIZE = 25;

export const SCORE_BANDS = [
  { key: '90-100', min: 90, max: 100, label: 'Critical opportunity' },
  { key: '80-89', min: 80, max: 89, label: 'Very high' },
  { key: '70-79', min: 70, max: 79, label: 'High' },
  { key: '60-69', min: 60, max: 69, label: 'Medium-high' },
  { key: '40-59', min: 40, max: 59, label: 'Medium' },
  { key: '0-39', min: 0, max: 39, label: 'Low' },
] as const;

export const DEFAULT_REAL_PROVIDERS = [
  'companywall',
  'biznismreza',
  'yellow-pages',
  'google-business',
  'industry-directory',
] as const;

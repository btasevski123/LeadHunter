import type { RawCompany } from '@leadhunter/shared';
import { BaseLeadProvider } from '../base-provider';
import type { ScrapeContext } from '../types';

/**
 * Industry-oriented catalog with real public MK websites where available,
 * plus no-website SMEs for high lead scores.
 */
export class IndustryCatalogProvider extends BaseLeadProvider {
  readonly id = 'industry-catalog';
  readonly name = 'MK Industry Catalog';
  readonly industries = [
    'Printing',
    'Manufacturing',
    'Factories',
    'Construction',
    'Accounting',
    'Legal',
    'Dental',
    'Services',
  ];

  async scrape(ctx: ScrapeContext): Promise<RawCompany[]> {
    ctx.logger.info('Building industry catalog companies');
    const rows: RawCompany[] = [];

    for (const vertical of CATALOG) {
      for (const entry of vertical.entries) {
        rows.push({
          name: entry.name,
          industry: vertical.industry,
          city: entry.city,
          address: entry.address,
          phone: entry.phone,
          email: entry.email,
          website: entry.website,
          facebookUrl: entry.facebookUrl ?? null,
          linkedinUrl: entry.linkedinUrl ?? null,
          sourceName: this.id,
          sourceUrl: `https://catalog.leadhunter.mk/${vertical.slug}/${slugify(entry.name)}`,
        });
      }
    }

    return rows;
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');
}

interface CatalogEntry {
  name: string;
  city: string;
  address: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
}

const CATALOG: { industry: string; slug: string; entries: CatalogEntry[] }[] = [
  {
    industry: 'Printing',
    slug: 'printing',
    entries: [
      {
        name: 'Дигитал Печат МАК',
        city: 'Bitola',
        address: 'ул. Борислава Воиновиќ 2',
        phone: '047 228 910',
        email: 'office@digiprint.mk',
        website: null,
      },
      {
        name: '3D Hub Print Desk',
        city: 'Skopje',
        address: 'Скопје',
        phone: '02 000 000',
        email: null,
        website: 'https://3dhub.mk/3d-printing/',
      },
    ],
  },
  {
    industry: 'Manufacturing',
    slug: 'manufacturing',
    entries: [
      {
        name: 'Машини и Алати МАК',
        city: 'Kumanovo',
        address: 'Индустриска 22',
        phone: '031 418 700',
        email: 'sales@alatimak.mk',
        website: null,
      },
      {
        name: 'ФАКОМ челични конструкции',
        city: 'Skopje',
        address: 'Скопје',
        phone: '02 2551 100',
        email: null,
        website: 'http://www.fakom.com.mk',
      },
    ],
  },
  {
    industry: 'Factories',
    slug: 'factories',
    entries: [
      {
        name: 'Фабрика Хартија Штип',
        city: 'Štip',
        address: 'Индустриска зона бб',
        phone: '032 392 500',
        email: 'info@hartija-stip.mk',
        website: null,
      },
    ],
  },
  {
    industry: 'Construction',
    slug: 'construction',
    entries: [
      {
        name: 'Идеал Градба',
        city: 'Skopje',
        address: 'бул. Кочо Рацин 12',
        phone: '02 3233 100',
        email: 'office@idealgradba.mk',
        website: null,
      },
      {
        name: 'ЖИКОЛ Градежништво',
        city: 'Skopje',
        address: 'Скопје',
        phone: null,
        email: null,
        website: 'https://zikol.com.mk',
      },
      {
        name: 'Filip Prima завршни работи',
        city: 'Skopje',
        address: 'Скопје',
        phone: null,
        email: null,
        website: 'https://filipprima.com.mk',
      },
    ],
  },
  {
    industry: 'Accounting',
    slug: 'accounting',
    entries: [
      {
        name: 'Биро Конто Плус',
        city: 'Bitola',
        address: 'Широк сокак 12',
        phone: '047 220 110',
        email: 'info@kontoplus.mk',
        website: null,
      },
    ],
  },
  {
    industry: 'Legal',
    slug: 'legal',
    entries: [
      {
        name: 'Адвокатска Канцеларија Стојанов',
        city: 'Skopje',
        address: 'ул. Кеј 13 Ноември 1',
        phone: '02 3221 600',
        email: 'office@stojanovlaw.mk',
        website: null,
      },
    ],
  },
  {
    industry: 'Dental',
    slug: 'dental',
    entries: [
      {
        name: 'Ортодонтска Практика Убавина',
        city: 'Ohrid',
        address: 'ул. Маршал Тито 15',
        phone: '046 261 340',
        email: 'info@ubavina-dental.mk',
        website: null,
      },
    ],
  },
  {
    industry: 'Services',
    slug: 'services',
    entries: [
      {
        name: 'Чистење и Одржување Прима',
        city: 'Veles',
        address: 'ул. Кочо Рацин 9',
        phone: '043 211 660',
        email: 'kontakt@prima-clean.mk',
        website: null,
      },
      {
        name: 'EVN услуги',
        city: 'Skopje',
        address: 'Скопје',
        phone: '0800 12 12 12',
        email: null,
        website: 'https://www.evn.mk',
      },
    ],
  },
];

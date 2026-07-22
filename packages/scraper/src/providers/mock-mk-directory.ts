import type { RawCompany } from '@leadhunter/shared';
import { INDUSTRIES, MK_CITIES } from '@leadhunter/shared';
import { BaseLeadProvider } from '../base-provider';
import type { ScrapeContext } from '../types';

/**
 * Seed directory for North Macedonia businesses.
 * Mixes:
 * - real public company websites (so audits/screenshots work locally)
 * - businesses with no website (highest-value freelance leads)
 */
export class MockMkDirectoryProvider extends BaseLeadProvider {
  readonly id = 'mock-mk-directory';
  readonly name = 'Mock MK Business Directory';
  readonly industries = [...INDUSTRIES];

  async scrape(ctx: ScrapeContext): Promise<RawCompany[]> {
    ctx.logger.info('Generating MK directory companies (real sites + no-website leads)');
    return SEED.map((row, index) => ({
      ...row,
      sourceName: this.id,
      sourceUrl: `https://directory.leadhunter.mk/mock/${index + 1}`,
    }));
  }
}

/** Real public sites used for local audit / screenshot demos. */
const WITH_REAL_WEBSITES: RawCompany[] = [
  {
    name: 'ЖИКОЛ',
    industry: 'Construction',
    city: 'Skopje',
    address: 'Скопје',
    phone: '02 3090 000',
    email: null,
    website: 'https://zikol.com.mk',
  },
  {
    name: 'ФАКОМ АД',
    industry: 'Manufacturing',
    city: 'Skopje',
    address: 'Скопје',
    phone: '02 2551 100',
    email: null,
    website: 'http://www.fakom.com.mk',
  },
  {
    name: 'Filip Prima',
    industry: 'Construction',
    city: 'Skopje',
    address: 'Скопје',
    phone: null,
    email: null,
    website: 'https://filipprima.com.mk',
  },
  {
    name: 'ЛИ-ДЕ Инженеринг',
    industry: 'Construction',
    city: 'Skopje',
    address: 'Скопје',
    phone: null,
    email: null,
    website: 'https://li-de.com.mk',
  },
  {
    name: '3D Hub Macedonia',
    industry: 'Manufacturing',
    city: 'Skopje',
    address: 'Скопје',
    phone: null,
    email: null,
    website: 'https://3dhub.mk',
  },
  {
    name: 'Македонски Телеком',
    industry: 'IT Services',
    city: 'Skopje',
    address: 'Кеј 13 Ноември',
    phone: '02 3200 000',
    email: null,
    website: 'https://www.telekom.mk',
  },
  {
    name: 'Стопанска банка АД Скопје',
    industry: 'Services',
    city: 'Skopje',
    address: 'ул. 11 Октомври 7',
    phone: '02 3296 800',
    email: null,
    website: 'https://www.stb.com.mk',
  },
  {
    name: 'Тиквеш Винарија',
    industry: 'Agriculture',
    city: 'Kavadarci',
    address: 'Кавадарци',
    phone: null,
    email: null,
    website: 'https://tikves.com.mk',
  },
  {
    name: 'Алкалоид АД',
    industry: 'Manufacturing',
    city: 'Skopje',
    address: 'бул. Александар Македонски 12',
    phone: '02 3104 000',
    email: null,
    website: 'https://www.alkaloid.com.mk',
  },
  {
    name: 'Универзитет Св. Кирил и Методиј',
    industry: 'Education',
    city: 'Skopje',
    address: 'бул. Гоце Делчев 9',
    phone: '02 3293 000',
    email: null,
    website: 'https://www.ukim.edu.mk',
  },
  {
    name: 'Општина Центар',
    industry: 'Services',
    city: 'Skopje',
    address: 'Скопје',
    phone: null,
    email: null,
    website: 'https://centar.gov.mk',
  },
  {
    name: 'Visit Ohrid',
    industry: 'Hospitality',
    city: 'Ohrid',
    address: 'Охрид',
    phone: null,
    email: null,
    website: 'https://www.ohrid.com.mk',
  },
  {
    name: 'Сеавус',
    industry: 'IT Services',
    city: 'Skopje',
    address: 'Скопје',
    phone: null,
    email: null,
    website: 'https://www.seavus.com',
  },
  {
    name: 'Netcetera Macedonia',
    industry: 'IT Services',
    city: 'Skopje',
    address: 'Скопје',
    phone: null,
    email: null,
    website: 'https://www.netcetera.com',
  },
  {
    name: 'EVN Macedonia',
    industry: 'Services',
    city: 'Skopje',
    address: 'Скопје',
    phone: '0800 12 12 12',
    email: null,
    website: 'https://www.evn.mk',
  },
  {
    name: 'Stopanska komora na Severna Makedonija',
    industry: 'Services',
    city: 'Skopje',
    address: 'Скопје',
    phone: null,
    email: null,
    website: 'https://www.mchamber.mk',
  },
  {
    name: 'Agency for Real Estate Cadastre',
    industry: 'Real Estate',
    city: 'Skopje',
    address: 'Скопје',
    phone: null,
    email: null,
    website: 'https://www.katastar.gov.mk',
  },
  {
    name: 'Makedonski Železnici Transport',
    industry: 'Logistics',
    city: 'Skopje',
    address: 'Скопје',
    phone: null,
    email: null,
    website: 'https://www.mzt.mk',
  },
  {
    name: 'Skopski saem',
    industry: 'Services',
    city: 'Skopje',
    address: 'Скопје',
    phone: null,
    email: null,
    website: 'https://www.skopjefair.com.mk',
  },
  {
    name: 'Hotel Aleksandar Palace',
    industry: 'Hospitality',
    city: 'Skopje',
    address: 'Скопје',
    phone: null,
    email: null,
    website: 'https://www.aleksandarpalace.com.mk',
  },
];

/** High-value leads: plausible local SMEs with no website. */
const NO_WEBSITE_LEADS: RawCompany[] = [
  {
    name: 'Печатница Брила',
    industry: 'Printing',
    city: 'Skopje',
    address: 'ул. Партизански одреди 45',
    phone: '+389 2 3123 450',
    email: 'info@brilaprint.mk',
    website: null,
    facebookUrl: 'https://facebook.com/brilaprint',
  },
  {
    name: 'Сметководство ПроФи',
    industry: 'Accounting',
    city: 'Tetovo',
    address: 'ул. Илирија 3',
    phone: '044 331 220',
    email: 'kontakt@profi-account.mk',
    website: null,
  },
  {
    name: 'Дентал Студио Орхидеја',
    industry: 'Dental',
    city: 'Ohrid',
    address: 'ул. Туристичка 9',
    phone: '046 262 505',
    email: null,
    website: null,
    facebookUrl: 'https://facebook.com/dentalorhideja',
  },
  {
    name: 'Автосервис Брзина',
    industry: 'Automotive',
    city: 'Kumanovo',
    address: 'ул. Народна револуција 120',
    phone: '031 425 300',
    email: null,
    website: null,
  },
  {
    name: 'Агро Плод Прилеп',
    industry: 'Agriculture',
    city: 'Prilep',
    address: 'село Тополчани бб',
    phone: '048 401 220',
    email: 'info@agroplod.mk',
    website: null,
  },
  {
    name: 'Чистење ПроСервис',
    industry: 'Services',
    city: 'Gostivar',
    address: 'ул. Браќа Ѓиноски 18',
    phone: '042 214 330',
    email: null,
    website: null,
  },
  {
    name: 'Дентална Ординација Бели Заби',
    industry: 'Dental',
    city: 'Skopje',
    address: 'ул. Наум Наумовски Борче 11',
    phone: '02 3177 200',
    email: 'kontakt@belizabi.mk',
    website: null,
    facebookUrl: 'https://facebook.com/belizabi',
  },
  {
    name: 'Производство Пластик Форм',
    industry: 'Manufacturing',
    city: 'Kavadarci',
    address: 'Индустриска 8',
    phone: '043 412 800',
    email: 'sales@plastikform.mk',
    website: null,
  },
  {
    name: 'Сметководствено Биро Баланс',
    industry: 'Accounting',
    city: 'Skopje',
    address: 'ул. Фредерик Шопен 6',
    phone: '02 3128 640',
    email: 'info@balance.mk',
    website: null,
  },
  {
    name: 'Трговија Домашен Рај',
    industry: 'Retail',
    city: 'Gevgelija',
    address: 'ул. 7-ми Ноември 33',
    phone: '034 213 700',
    email: null,
    website: null,
  },
  {
    name: 'Бетон Струм',
    industry: 'Construction',
    city: 'Strumica',
    address: 'ул. Ленинова 88',
    phone: '034 340 150',
    email: 'kontakt@betonstrum.mk',
    website: null,
  },
  {
    name: 'Финансии Експерт',
    industry: 'Accounting',
    city: 'Skopje',
    address: 'ул. Даме Груев 4',
    phone: '02 3110 450',
    email: 'info@financexpert.mk',
    website: null,
    facebookUrl: 'https://facebook.com/financexpertmk',
  },
  {
    name: 'Дентал Клиник Сјај',
    industry: 'Dental',
    city: 'Tetovo',
    address: 'ул. ЈНА 20',
    phone: '044 334 880',
    email: null,
    website: null,
    facebookUrl: 'https://facebook.com/dentalsjaj',
  },
  {
    name: 'Технички Сервис Сигурност',
    industry: 'Services',
    city: 'Gostivar',
    address: 'ул. Браќа Ѓиноски 55',
    phone: '042 215 770',
    email: 'info@sigurnost.mk',
    website: null,
  },
  {
    name: 'PrintMaster Скопје',
    industry: 'Printing',
    city: 'Skopje',
    address: 'ул. 50-та Дивизија 10',
    phone: '02 3144 200',
    email: 'info@printmaster.mk',
    website: null,
  },
  {
    name: 'Вуд Продакшн Прилеп',
    industry: 'Manufacturing',
    city: 'Prilep',
    address: 'Зона север 5',
    phone: '048 400 330',
    email: null,
    website: null,
  },
];

function expandNoWebsiteLeads(): RawCompany[] {
  const prefixes: { industry: string; prefix: string }[] = [
    { industry: 'Construction', prefix: 'Градежна фирма' },
    { industry: 'Printing', prefix: 'Печатница' },
    { industry: 'Dental', prefix: 'Дентална ординација' },
    { industry: 'Accounting', prefix: 'Сметководство' },
    { industry: 'Legal', prefix: 'Адвокатска канцеларија' },
    { industry: 'Automotive', prefix: 'Автосервис' },
    { industry: 'Services', prefix: 'Услуги' },
    { industry: 'Manufacturing', prefix: 'Производство' },
    { industry: 'Retail', prefix: 'Трговија' },
    { industry: 'Hospitality', prefix: 'Пансион' },
  ];

  const out: RawCompany[] = [];
  let n = 1;
  for (const city of MK_CITIES) {
    for (const item of prefixes) {
      const hasEmail = n % 3 !== 0;
      out.push({
        name: `${item.prefix} ${city} ${n}`,
        industry: item.industry,
        city,
        address: `ул. Индустриска ${n}`,
        phone: `02 3${String(100 + (n % 800)).padStart(3, '0')} ${String(100 + n).slice(-3)}`,
        email: hasEmail ? `info@biznis${n}.mk` : null,
        website: null,
        facebookUrl: n % 7 === 0 ? `https://facebook.com/biznis${n}` : null,
      });
      n += 1;
    }
  }
  return out;
}

const SEED: RawCompany[] = [
  ...WITH_REAL_WEBSITES,
  ...NO_WEBSITE_LEADS,
  ...expandNoWebsiteLeads(),
];

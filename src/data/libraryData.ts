import {CategoryIconName, CategoryItem, SiteSettings} from '../types/library';

export const COVER_IMAGES = {
  libraryFeature: '/src/assets/images/feature_islamic_library_1795378756930.jpg',
};

export const DEFAULT_HERO_DESCRIPTION =
  'ဤ အခမဲ့ အွန်လိုင်း အစ္စလာမ့်စာကြည့်တိုက်တွင် ကုရ်အာန်ကျမ်းတော်မြတ်နှင့်ကိုယ်တော်မြတ် (ဆွ) ၏ မွန်မြတ်လှသော ဟဒီးစ်တော်များ၊ အစ္စလာမ့်ယုံကြည်ချက်အကီဒဟ်များ၊ သမိုင်းဖတ်စာများ၊ အစ္စလာမ်ရှရီအသ်ဥပဒေများ၊ ဒိုအာနှင့် အအ်မာလ်များ၊ ကိုယ်ကျင့်သီလနှင့်  ကောင်ရာညွန်းကြားခြင်းများဆိုင်ရာ PDF စာအုပ်များနှင့် သုတေသနစာတမ်းများကို စုံလင်စွာ ဖတ်ရှုဒေါင်းလုဒ်ရယူနိုင်ပါသည်။';

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  hiddenSections: [],
  hiddenCategories: [],
  driveFolderId: '',
  driveFolderName: 'Myanmar Muslim Library PDFs',
  heroDescription: DEFAULT_HERO_DESCRIPTION,
};

export const MANAGEABLE_SECTIONS: {id: string; label: string}[] = [
  {id: 'duas', label: 'ဒိုအာများ (Duas)'},
  {id: 'videos', label: 'ဗီဒီယိုများ (Videos)'},
  {id: 'articles', label: 'သတင်းဆောင်းပါးများ (Articles)'},
  {id: 'about', label: 'ကျွန်ုပ်တို့အကြောင်း (About Us)'},
  {id: 'publishing', label: 'စာပေဖြန့်ချိရေး (Publishing)'},
  {id: 'contact', label: 'ဆက်သွယ်ရန် (Contact)'},
];

export const CATEGORIES: CategoryItem[] = [
  {
    id: 'quran-tafsir',
    nameMy: 'ကုရ်အာန်နှင့် သဖ်စီးရ်',
    nameEn: 'Quran & Tafsir',
    descriptionMy: 'ကျမ်းမြတ်ကုရ်အာန် ဘာသာပြန်နှင့် အနက်ဖွင့်ကျမ်းစာအုပ်များ',
    iconName: 'book-open',
  },
  {
    id: 'hadith',
    nameMy: 'ဟဒီးစ်တော်များ',
    nameEn: 'Hadith Collections',
    descriptionMy: 'တမန်တော်မြတ် (ဆွ) နှင့် အဲဟ်လေဗိုက်သ် (အ.စ) ၏ ဩဝါဒတော်များ',
    iconName: 'scroll-text',
  },
  {
    id: 'shariah',
    nameMy: 'ရှရီအသ်တရားဥပဒေ',
    nameEn: 'Shariah & Fiqh',
    descriptionMy: 'နေ့စဉ်ကျင့်သုံးဖွယ်ရာ ဖိကဟ်နှင့် ရှရီအသ်စည်းမျဉ်းများ',
    iconName: 'scale',
  },
  {
    id: 'dua-amal',
    nameMy: 'ဒိုအာနှင့်အအ်မာလ်များ',
    nameEn: 'Duas & A’mal',
    descriptionMy: 'နေ့စဉ်နှင့် လမြတ်များအတွက် ဒိုအာနှင့် ကျင့်စဉ်များ',
    iconName: 'heart-handshake',
  },
  {
    id: 'aqeedah',
    nameMy: 'အကီဒဟ် (ယုံကြည်ချက်)',
    nameEn: 'Aqeedah & Creed',
    descriptionMy: 'အစ္စလာမ့်အခြေခံ ယုံကြည်ချက်နှင့် သောင်ဟီးဒ်သဘောတရားများ',
    iconName: 'star',
  },
  {
    id: 'history',
    nameMy: 'အစ္စလာမ့်သမိုင်း',
    nameEn: 'Islamic History',
    descriptionMy: 'တမန်တော်များ၊ အိမာမ်သခင်များနှင့် မြတ်သောပုဂ္ဂိုလ်ကြီးများ၏ အတ္ထုပ္ပတ္တိ',
    iconName: 'history',
  },
  {
    id: 'ethics',
    nameMy: 'ကိုယ်ကျင့်နီတိ',
    nameEn: 'Ethics & Akhlaq',
    descriptionMy: 'စိတ်နှလုံးသန့်စင်ရေးနှင့် အစ္စလာမ့်ကိုယ်ကျင့်တရားကျမ်းများ',
    iconName: 'heart',
  },
  {
    id: 'children',
    nameMy: 'ရင်သွေးငယ်များ',
    nameEn: 'Children’s Corner',
    descriptionMy: 'ကလေးငယ်များအတွက် ပုံပြင်များနှင့် အခြေခံသင်ခန်းစာများ',
    iconName: 'baby',
  },
  {
    id: 'periodicals',
    nameMy: 'စာစောင်များ',
    nameEn: 'Monthly Periodicals',
    descriptionMy: 'လစဉ်ထုတ် နံရံကပ်စာစောင်များနှင့် အထူးထုတ်မဂ္ဂဇင်းများ',
    iconName: 'newspaper',
  },
  {
    id: 'research',
    nameMy: 'သုတေသနစာတမ်းများ',
    nameEn: 'Research Papers',
    descriptionMy: 'ခေတ်ပြိုင်အစ္စလာမ့်အတွေးအခေါ်နှင့် ပညာရပ်ဆိုင်ရာစာတမ်းများ',
    iconName: 'file-search',
  },
  {
    id: 'azan',
    nameMy: 'အဇာန်အချိန်ပြဇယားများ',
    nameEn: 'Azan Timetables',
    descriptionMy: 'မြန်မာနိုင်ငံ မြို့အသီးသီးအတွက် ဆွလာသ်ဝတ်ပြုချိန်ဇယားများ',
    iconName: 'clock',
  },
  {
    id: 'videos',
    nameMy: 'ဗီဒီယိုများ',
    nameEn: 'Video Lectures',
    descriptionMy: 'တရားတော်များ၊ ဆွေးနွေးပွဲများနှင့် မှတ်တမ်းဗီဒီယိုများ',
    iconName: 'video',
  },
];

export const BUILT_IN_CATEGORY_IDS = new Set<string>(
  CATEGORIES.map((c) => c.id),
);

export const CATEGORY_ICON_OPTIONS: {id: CategoryIconName; label: string}[] = [
  {id: 'book-open', label: 'ကျမ်းစာအုပ်'},
  {id: 'scroll-text', label: 'စာမူ / ဟဒီးစ်'},
  {id: 'scale', label: 'ဥပဒေ / ဖိကဟ်'},
  {id: 'heart-handshake', label: 'ဒိုအာ / မေတ္တာ'},
  {id: 'star', label: 'အကီဒဟ် / ကြယ်'},
  {id: 'history', label: 'သမိုင်း'},
  {id: 'heart', label: 'ကိုယ်ကျင့် / နှလုံးသား'},
  {id: 'baby', label: 'ကလေး / ရင်သွေး'},
  {id: 'newspaper', label: 'စာစောင် / မဂ္ဂဇင်း'},
  {id: 'file-search', label: 'သုတေသန'},
  {id: 'clock', label: 'အချိန်ဇယား'},
  {id: 'video', label: 'ဗီဒီယို'},
  {id: 'folder', label: 'ဖိုင်တွဲ (Folder)'},
  {id: 'layers', label: 'ကဏ္ဍခွဲ (Layers)'},
  {id: 'sparkles', label: 'အထူးကဏ္ဍ (Special)'},
];

export function mergeCategories(
  customDocs: CategoryItem[],
): CategoryItem[] {
  const docMap = new Map<string, CategoryItem>();
  for (const doc of customDocs) {
    if (doc.id && doc.id !== 'all') {
      docMap.set(doc.id, doc);
    }
  }

  const mergedBuiltIns: CategoryItem[] = CATEGORIES.map((base, idx) => {
    const override = docMap.get(base.id);
    if (override) {
      return {
        ...base,
        nameMy: override.nameMy || base.nameMy,
        nameEn: override.nameEn ?? base.nameEn,
        descriptionMy: override.descriptionMy ?? base.descriptionMy,
        iconName: override.iconName || base.iconName,
        sortOrder:
          typeof override.sortOrder === 'number' ? override.sortOrder : idx,
        isCustom: false,
        isOverridden: true,
      };
    }
    return {
      ...base,
      sortOrder: idx,
      isCustom: false,
      isOverridden: false,
    };
  });

  const extraCustomCategories: CategoryItem[] = customDocs
    .filter((doc) => !BUILT_IN_CATEGORY_IDS.has(doc.id))
    .map((doc, idx) => ({
      ...doc,
      sortOrder:
        typeof doc.sortOrder === 'number'
          ? doc.sortOrder
          : CATEGORIES.length + idx,
      isCustom: true,
      isOverridden: false,
    }))
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));

  return [...mergedBuiltIns, ...extraCustomCategories];
}

export function generateCategorySlug(
  nameEn: string,
  existingIds: Set<string>,
): string {
  const base = nameEn
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 44);

  const candidateBase =
    base && base !== 'all' && base !== 'videos'
      ? base
      : `cat-${Date.now().toString(36)}`;

  let candidate = candidateBase;
  let counter = 2;
  while (existingIds.has(candidate) || candidate === 'all' || candidate === 'videos') {
    candidate = `${candidateBase}-${counter}`.slice(0, 58);
    counter += 1;
  }
  return candidate;
}

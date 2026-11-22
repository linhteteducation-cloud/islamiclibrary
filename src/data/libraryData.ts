import {CategoryItem, SiteSettings} from '../types/library';

export const COVER_IMAGES = {
  libraryFeature: '/src/assets/images/feature_islamic_library_1795378756930.jpg',
};

export const DEFAULT_HERO_DESCRIPTION =
  'ဤ အခမဲ့ အွန်လိုင်း အစ္စလာမ်စာကြည့်တိုက်တွင် ကုရ်အာန်၊ အဲဟ်လေဗိုက်သ် (အ.စ) ၏ ဟဒီးစ်တော်များ၊ အစ္စလာမ့်ယုံကြည်ချက်၊ သမိုင်း၊ ရှရီအသ်ဥပဒေ၊ ဒိုအာနှင့် အအ်မာလ်များ၊ ကိုယ်ကျင့်နီတိနှင့် ရင်သွေးငယ်များဆိုင်ရာ PDF စာအုပ်များ၊ သုတေသနစာတမ်းများနှင့် လစဉ်ထုတ် စာစောင်များကို စုံလင်စွာ ဖတ်ရှုဒေါင်းလုဒ်ရယူနိုင်ပါသည်။';

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  hiddenSections: [],
  hiddenCategories: [],
  driveFolderId: '',
  driveFolderName: 'Myanmar Islamic Library PDFs',
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

import {useEffect, useMemo, useState} from 'react';
import {CalculationMethod, Coordinates, Madhab, PrayerTimes} from 'adhan';
import {Clock, MapPin, Sparkles} from 'lucide-react';

interface MyanmarDivision {
  name: string;
  capital: string;
  lat: number;
  lng: number;
}

// 14 States and Regions of Myanmar + Naypyidaw Union Territory
const MYANMAR_DIVISIONS: MyanmarDivision[] = [
  {name: 'ရန်ကုန်တိုင်း', capital: 'ရန်ကုန်', lat: 16.8409, lng: 96.1735},
  {name: 'မန္တလေးတိုင်း', capital: 'မန္တလေး', lat: 21.9588, lng: 96.0891},
  {name: 'နေပြည်တော်', capital: 'နေပြည်တော်', lat: 19.7633, lng: 96.0785},
  {name: 'ဧရာဝတီတိုင်း', capital: 'ပုသိမ်', lat: 16.7792, lng: 94.7317},
  {name: 'ပဲခူးတိုင်း', capital: 'ပဲခူး', lat: 17.3245, lng: 96.4786},
  {name: 'မကွေးတိုင်း', capital: 'မကွေး', lat: 20.1512, lng: 94.9256},
  {name: 'စစ်ကိုင်းတိုင်း', capital: 'စစ်ကိုင်း', lat: 21.8906, lng: 95.9754},
  {name: 'တနင်္သာရီတိုင်း', capital: 'ထားဝယ်', lat: 14.0763, lng: 98.1963},
  {name: 'ကချင်ပြည်နယ်', capital: 'မြစ်ကြီးနား', lat: 25.3833, lng: 97.4000},
  {name: 'ကယားပြည်နယ်', capital: 'လွိုင်ကော်', lat: 19.6742, lng: 97.2094},
  {name: 'ကရင်ပြည်နယ်', capital: 'ဘားအံ', lat: 16.8920, lng: 97.6335},
  {name: 'ချင်းပြည်နယ်', capital: 'ဟားခါး', lat: 22.6425, lng: 93.6331},
  {name: 'မွန်ပြည်နယ်', capital: 'မော်လမြိုင်', lat: 16.4917, lng: 97.6256},
  {name: 'ရခိုင်ပြည်နယ်', capital: 'စစ်တွေ', lat: 20.1496, lng: 92.8973},
  {name: 'ရှမ်းပြည်နယ်', capital: 'တောင်ကြီး', lat: 20.7845, lng: 97.0328},
];

function toMyanNum(str: string): string {
  return str
    .replace(/0/g, '၀')
    .replace(/1/g, '၁')
    .replace(/2/g, '၂')
    .replace(/3/g, '၃')
    .replace(/4/g, '၄')
    .replace(/5/g, '၅')
    .replace(/6/g, '၆')
    .replace(/7/g, '၇')
    .replace(/8/g, '၈')
    .replace(/9/g, '၉');
}

function formatTime12Hr(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Yangon',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date);
  let hour = '';
  let minute = '';
  let dayPeriod = 'AM';
  for (const part of parts) {
    if (part.type === 'hour') hour = part.value;
    if (part.type === 'minute') minute = part.value;
    if (part.type === 'dayPeriod') dayPeriod = part.value.toUpperCase();
  }

  const hNum = Number(hour);
  const burmesePeriod =
    dayPeriod === 'AM'
      ? hNum === 12
        ? 'ညဉ့်'
        : hNum >= 11
        ? 'နေ့လယ်'
        : 'နံနက်'
      : hNum === 12
      ? 'နေ့လယ်'
      : hNum < 4
      ? 'မွန်းလွဲ'
      : hNum < 7
      ? 'ညနေ'
      : 'ည';

  const paddedHour = hour.padStart(2, '0');
  return `${burmesePeriod} ${toMyanNum(paddedHour)}:${toMyanNum(minute)}`;
}

export function PrayerTimesTicker() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [isFading, setIsFading] = useState(false);

  // Auto-rotate every 5 seconds if user hasn't manually selected recently
  useEffect(() => {
    if (!isAutoRotating) return;
    const timer = window.setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setSelectedIndex((prev) => (prev + 1) % MYANMAR_DIVISIONS.length);
        setIsFading(false);
      }, 300);
    }, 5500);

    return () => window.clearInterval(timer);
  }, [isAutoRotating]);

  const activeCity = MYANMAR_DIVISIONS[selectedIndex];

  // University of Islamic Sciences, Karachi method with Hanafi Asr
  const calculatedTimes = useMemo(() => {
    const coordinates = new Coordinates(activeCity.lat, activeCity.lng);
    const params = CalculationMethod.Karachi();
    params.madhab = Madhab.Hanafi;
    const now = new Date();
    const prayerTimes = new PrayerTimes(coordinates, now, params);

    // Astronomical Solar Noon (Zawal) is precisely when Dhuhr begins or 2-3 mins prior
    const solarNoon = new Date(prayerTimes.dhuhr.getTime() - 2 * 60 * 1000);

    return {
      fajr: formatTime12Hr(prayerTimes.fajr),
      noon: formatTime12Hr(solarNoon),
      dhuhr: formatTime12Hr(prayerTimes.dhuhr),
      asr: formatTime12Hr(prayerTimes.asr),
      maghrib: formatTime12Hr(prayerTimes.maghrib),
      isha: formatTime12Hr(prayerTimes.isha),
    };
  }, [activeCity.lat, activeCity.lng]);

  return (
    <aside
      aria-label="Daily Islamic Prayer Times ticker"
      className="bg-gradient-to-r from-[#0B351E] via-[#115E34] to-[#0D4726] text-white border-b border-[#082816] px-3 py-1.5 text-xs shadow-inner select-none"
    >
      <div className="max-w-[1360px] mx-auto flex flex-col md:flex-row items-center justify-between gap-2 overflow-hidden">
        {/* Method Label & City Selector */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex items-center gap-1.5 text-[#F3D786] font-semibold text-[11.5px] sm:text-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#F3D786] shrink-0" />
            <span className="hidden sm:inline">နမာဇ်အချိန်များ:</span>
            <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-black/25 text-[#E7C664] border border-white/10">
              ကရာချီတက္ကသိုလ်စံနှုန်း · ဟနဖီ
            </span>
          </div>

          <div className="relative inline-flex items-center">
            <MapPin className="w-3.5 h-3.5 text-[#F3D786] absolute left-2 pointer-events-none" />
            <select
              aria-label="ရွေးချယ်ထားသော တိုင်း/ပြည်နယ်"
              value={selectedIndex}
              onChange={(e) => {
                setSelectedIndex(Number(e.target.value));
                setIsAutoRotating(false);
                setIsFading(false);
              }}
              className="bg-black/35 hover:bg-black/50 text-[#FFF9E6] text-xs font-semibold pl-6 pr-2.5 py-1 rounded-md border border-white/20 focus:outline-none focus:ring-1 focus:ring-[#F3D786] cursor-pointer transition-colors"
            >
              {MYANMAR_DIVISIONS.map((div, idx) => (
                <option key={div.name} value={idx} className="bg-[#14442A] text-white">
                  {div.name} ({div.capital})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Live Prayer Times row */}
        <div
          className={`flex items-center justify-center gap-x-2.5 sm:gap-x-3.5 overflow-x-auto pb-0.5 max-w-full text-[11.5px] sm:text-xs tracking-tight transition-opacity duration-300 ${
            isFading ? 'opacity-0 scale-98' : 'opacity-100 scale-100'
          }`}
        >
          <span className="inline-flex items-center gap-1 shrink-0">
            <Clock className="w-3 h-3 text-[#F3D786]" />
            <strong className="text-white font-semibold">ဖဂျရ်</strong>
            <span className="text-white/95 tabular-nums">{calculatedTimes.fajr}</span>
          </span>

          <span aria-hidden="true" className="text-white/35">|</span>

          <span className="inline-flex items-center gap-1 shrink-0">
            <strong className="text-white font-semibold">မွန်းတည့်</strong>
            <span className="text-white/95 tabular-nums">{calculatedTimes.noon}</span>
          </span>

          <span aria-hidden="true" className="text-white/35">|</span>

          <span className="inline-flex items-center gap-1 shrink-0">
            <strong className="text-white font-semibold">ဇိုဟိုရ်</strong>
            <span className="text-white/95 tabular-nums">{calculatedTimes.dhuhr}</span>
          </span>

          <span aria-hidden="true" className="text-white/35">|</span>

          <span className="inline-flex items-center gap-1 shrink-0">
            <strong className="text-[#F3D786] font-semibold">အဆွရ်</strong>
            <span className="text-white/95 tabular-nums">{calculatedTimes.asr}</span>
          </span>

          <span aria-hidden="true" className="text-white/35">|</span>

          <span className="inline-flex items-center gap-1 shrink-0">
            <strong className="text-white font-semibold">မဂ်ရိဘ်</strong>
            <span className="text-white/95 tabular-nums">{calculatedTimes.maghrib}</span>
          </span>

          <span aria-hidden="true" className="text-white/35">|</span>

          <span className="inline-flex items-center gap-1 shrink-0">
            <strong className="text-white font-semibold">အိရှာ</strong>
            <span className="text-white/95 tabular-nums">{calculatedTimes.isha}</span>
          </span>
        </div>
      </div>
    </aside>
  );
}

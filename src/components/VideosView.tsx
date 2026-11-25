import {useState} from 'react';
import {ExternalLink, Play, User, Video} from 'lucide-react';
import {isValidSafeHttpsUrl} from '../lib/googleDrive';
import {VideoItem} from '../types/library';

export function VideosView({videos}: {videos: VideoItem[]}) {
  const [selectedTopic, setSelectedTopic] = useState('အားလုံး');

  const topics = [
    'အားလုံး',
    ...Array.from(new Set(videos.map((v) => v.categoryMy))),
  ];
  const filtered =
    selectedTopic === 'အားလုံး'
      ? videos
      : videos.filter((v) => v.categoryMy === selectedTopic);

  return (
    <div>
      <section className="islamic-lattice-bg relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 islamic-pattern-overlay pointer-events-none"
        />
        <div className="relative max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 text-white">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold mb-2">
            ဗီဒီယိုနှင့် တရားတော်များ
          </h1>
          <p className="text-sm sm:text-[15px] text-[#DCE4F2] max-w-2xl leading-[1.8]">
            ကုရ်အာန်သဖ်စီးရ် ဟောပြောချက်များနှင့် ပညာပေးဗီဒီယိုများကို ကြည့်ရှုလေ့လာနိုင်ပါသည်။
          </p>
        </div>
      </section>

      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
        {videos.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {topics.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => setSelectedTopic(topic)}
                className={`min-h-[40px] px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                  selectedTopic === topic
                    ? 'bg-[#1E3A8A] dark:bg-[#2563EB] text-white font-semibold'
                    : 'bg-white dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] text-[#334155] dark:text-[#CBD5E1] hover:bg-[#EFF3FA] dark:hover:bg-[#131E36]'
                }`}
              >
                {topic}
              </button>
            ))}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] rounded-xl p-10 text-center space-y-2">
            <Video className="w-9 h-9 text-[#64748B] dark:text-[#94A3B8] mx-auto" />
            <p className="text-base font-semibold text-[#131B2E] dark:text-[#F1F5F9]">
              ဗီဒီယိုများ မထည့်သွင်းရသေးပါ
            </p>
            <p className="text-sm text-[#525E75] dark:text-[#94A3B8]">
              Admin Panel မှတစ်ဆင့် ဗီဒီယိုလင့်ခ်များ ထည့်သွင်းနိုင်ပါသည်။
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((video) => {
              const safeUrl = isValidSafeHttpsUrl(video.videoUrl)
                ? video.videoUrl
                : '';
              return (
                <article
                  key={video.id}
                  className="bg-white dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] hover:border-[#1E3A8A]/40 dark:hover:border-[#60A5FA]/50 rounded-xl overflow-hidden flex flex-col transition-all duration-150 hover:shadow-md dark:hover:shadow-black/40"
                >
                  <div className="aspect-video w-full bg-gradient-to-br from-[#0E1B36] to-[#173066] flex flex-col items-center justify-center p-6 text-center text-white relative">
                    <div className="w-12 h-12 rounded-full bg-[#B85338] flex items-center justify-center mb-2 shadow-sm">
                      <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
                    </div>
                    {video.duration && (
                      <span className="text-xs text-[#E2C792] tabular-nums">
                        {video.duration}
                      </span>
                    )}
                  </div>

                  <div className="p-5 flex flex-col flex-1">
                    <p className="text-xs font-semibold text-[#B85338] dark:text-[#F0947A] mb-1">
                      {video.categoryMy}
                    </p>
                    <h2 className="text-base font-bold text-[#131B2E] dark:text-[#F1F5F9] leading-snug mb-2">
                      {video.title}
                    </h2>
                    <p className="text-xs text-[#525E75] dark:text-[#94A3B8] flex items-center gap-1.5 mb-3">
                      <User className="w-3.5 h-3.5 text-[#1E3A8A] dark:text-[#60A5FA]" />
                      <span>{video.speaker}</span>
                    </p>
                    {video.description && (
                      <p className="text-sm text-[#475569] dark:text-[#CBD5E1] line-clamp-3 mb-4 leading-relaxed">
                        {video.description}
                      </p>
                    )}

                    <div className="mt-auto pt-3 border-t border-[#EFF2F7] dark:border-[#1E2C4A] flex justify-end">
                      {safeUrl && (
                        <a
                          href={safeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[38px] px-4 py-1.5 rounded-md bg-[#1E3A8A] dark:bg-[#2563EB] hover:bg-[#172D6B] dark:hover:bg-[#3B82F6] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                        >
                          <span>ကြည့်ရှုရန်</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

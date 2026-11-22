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
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            ဗီဒီယိုနှင့် တရားတော်များ
          </h1>
          <p className="text-sm sm:text-[15px] text-[#E4EFE7] max-w-2xl leading-relaxed">
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
                    ? 'bg-[#146B3A] text-white font-semibold'
                    : 'bg-white border border-[#E2E8E4] text-[#35433A] hover:bg-[#EBF4EE]'
                }`}
              >
                {topic}
              </button>
            ))}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="bg-white border border-[#E2E8E4] rounded-xl p-10 text-center space-y-2">
            <Video className="w-9 h-9 text-[#86948B] mx-auto" />
            <p className="text-base font-semibold text-[#1A241E]">
              ဗီဒီယိုများ မထည့်သွင်းရသေးပါ
            </p>
            <p className="text-sm text-[#5A6860]">
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
                  className="bg-white border border-[#E2E8E4] rounded-xl overflow-hidden flex flex-col transition-shadow duration-150 hover:shadow-md"
                >
                  <div className="aspect-video w-full bg-[#115E34] flex flex-col items-center justify-center p-6 text-center text-white relative">
                    <div className="w-12 h-12 rounded-full bg-[#C59B27] flex items-center justify-center mb-2 shadow-sm">
                      <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
                    </div>
                    {video.duration && (
                      <span className="text-xs text-[#E8C868] tabular-nums">
                        {video.duration}
                      </span>
                    )}
                  </div>

                  <div className="p-5 flex flex-col flex-1">
                    <p className="text-xs font-medium text-[#9B7417] mb-1">
                      {video.categoryMy}
                    </p>
                    <h2 className="text-base font-bold text-[#1A241E] leading-snug mb-2">
                      {video.title}
                    </h2>
                    <p className="text-xs text-[#526058] flex items-center gap-1.5 mb-3">
                      <User className="w-3.5 h-3.5 text-[#146B3A]" />
                      <span>{video.speaker}</span>
                    </p>
                    {video.description && (
                      <p className="text-sm text-[#425048] line-clamp-3 mb-4">
                        {video.description}
                      </p>
                    )}

                    <div className="mt-auto pt-3 border-t border-[#EFF3F0] flex justify-end">
                      {safeUrl && (
                        <a
                          href={safeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-1.5 rounded-md bg-[#146B3A] hover:bg-[#0F522D] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
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

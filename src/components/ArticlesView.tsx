import {useState} from 'react';
import {ArrowRight, Newspaper, X} from 'lucide-react';
import {ArticleItem} from '../types/library';

export function ArticlesView({articles}: {articles: ArticleItem[]}) {
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);
  const activeArticle = activeArticleId
    ? articles.find((a) => a.id === activeArticleId) ?? null
    : null;

  return (
    <div>
      <section className="islamic-lattice-bg relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 islamic-pattern-overlay pointer-events-none"
        />
        <div className="relative max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 text-white">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            သတင်းဆောင်းပါးများ
          </h1>
          <p className="text-sm sm:text-[15px] text-[#E4EFE7] max-w-2xl leading-relaxed">
            အစ္စလာမ့်စာပေဆိုင်ရာ သတင်းများနှင့် ပညာရပ်ဆိုင်ရာ ဆောင်းပါးများကို
            ဖတ်ရှုနိုင်ပါသည်။
          </p>
        </div>
      </section>

      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {articles.length === 0 ? (
          <div className="bg-white border border-[#E2E8E4] rounded-xl p-10 text-center space-y-2">
            <Newspaper className="w-9 h-9 text-[#86948B] mx-auto" />
            <p className="text-base font-semibold text-[#1A241E]">
              ဆောင်းပါးများ မထည့်သွင်းရသေးပါ
            </p>
            <p className="text-sm text-[#5A6860]">
              Admin Panel မှတစ်ဆင့် သတင်းနှင့် ဆောင်းပါးအသစ်များ ထည့်သွင်းနိုင်ပါသည်။
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {articles.map((article) => (
              <article
                key={article.id}
                className="bg-white border border-[#E2E8E4] rounded-xl p-5 sm:p-6 flex flex-col transition-shadow hover:shadow-md"
              >
                <p className="text-xs font-medium text-[#9B7417] mb-1.5">
                  {article.kicker}
                </p>
                <h2 className="text-lg font-bold text-[#1A241E] leading-snug mb-2">
                  {article.title}
                </h2>
                <p className="text-sm text-[#4A5850] leading-relaxed mb-5 flex-1">
                  {article.excerpt}
                </p>
                <div className="pt-4 border-t border-[#EDF1EE] flex items-center justify-between gap-3">
                  <span className="text-xs text-[#5A6860]">
                    {article.author}
                    {article.createdAtLabel ? ` · ${article.createdAtLabel}` : ''}
                    {article.readTime ? ` · ${article.readTime}` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveArticleId(article.id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#146B3A] hover:text-[#0F522D]"
                  >
                    <span>အပြည့်အစုံဖတ်ရန်</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {activeArticle && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setActiveArticleId(null)}
        >
          <div
            className="bg-white w-full max-w-2xl max-h-[90vh] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-[#E2E8E4] bg-[#F8FAF9] flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-[#9B7417]">
                {activeArticle.kicker}
              </span>
              <button
                type="button"
                onClick={() => setActiveArticleId(null)}
                aria-label="Close article"
                className="w-10 h-10 rounded-lg border border-[#D4DDD7] bg-white flex items-center justify-center text-[#1A241E] hover:bg-[#EDF2EE]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-6 sm:p-8 space-y-5">
              <h2 className="text-xl sm:text-2xl font-bold text-[#1A241E] leading-snug">
                {activeArticle.title}
              </h2>
              <p className="text-xs text-[#5A6860] pb-4 border-b border-[#EDF1EE]">
                {activeArticle.author}
                {activeArticle.createdAtLabel ? ` · ${activeArticle.createdAtLabel}` : ''}
                {activeArticle.readTime ? ` · ${activeArticle.readTime}` : ''}
              </p>
              <div className="space-y-4 text-[15.5px] leading-[1.85] text-[#232F28] max-w-prose whitespace-pre-line">
                {activeArticle.body}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

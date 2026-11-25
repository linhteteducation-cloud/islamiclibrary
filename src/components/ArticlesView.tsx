import {useState} from 'react';
import {ArrowRight, Newspaper, X} from 'lucide-react';
import {getScriptFontClass} from '../lib/scriptFonts';
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
          <h1 className="font-serif text-2xl sm:text-3xl font-bold mb-2">
            သတင်းဆောင်းပါးများ
          </h1>
          <p className="text-sm sm:text-[15px] text-[#DCE4F2] max-w-2xl leading-[1.8]">
            အစ္စလာမ့်စာပေဆိုင်ရာ သတင်းများနှင့် ပညာရပ်ဆိုင်ရာ ဆောင်းပါးများကို
            ဖတ်ရှုနိုင်ပါသည်။
          </p>
        </div>
      </section>

      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {articles.length === 0 ? (
          <div className="bg-white dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] rounded-xl p-10 text-center space-y-2">
            <Newspaper className="w-9 h-9 text-[#64748B] dark:text-[#94A3B8] mx-auto" />
            <p className="text-base font-semibold text-[#131B2E] dark:text-[#F1F5F9]">
              ဆောင်းပါးများ မထည့်သွင်းရသေးပါ
            </p>
            <p className="text-sm text-[#525E75] dark:text-[#94A3B8]">
              Admin Panel မှတစ်ဆင့် သတင်းနှင့် ဆောင်းပါးအသစ်များ ထည့်သွင်းနိုင်ပါသည်။
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {articles.map((article) => (
              <article
                key={article.id}
                className="bg-white dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] hover:border-[#1E3A8A]/40 dark:hover:border-[#60A5FA]/50 rounded-xl p-5 sm:p-6 flex flex-col transition-all hover:shadow-md dark:hover:shadow-black/40"
              >
                <p className="text-xs font-semibold text-[#B85338] dark:text-[#F0947A] mb-1.5">
                  {article.kicker}
                </p>
                <h2
                  className={`text-lg font-bold text-[#131B2E] dark:text-[#F1F5F9] leading-snug mb-2 ${getScriptFontClass(article.title)}`}
                >
                  {article.title}
                </h2>
                <p
                  className={`text-sm text-[#475569] dark:text-[#CBD5E1] leading-[1.8] mb-5 flex-1 ${getScriptFontClass(article.excerpt)}`}
                >
                  {article.excerpt}
                </p>
                <div className="pt-4 border-t border-[#EFF2F7] dark:border-[#1E2C4A] flex items-center justify-between gap-3">
                  <span className="text-xs text-[#525E75] dark:text-[#94A3B8]">
                    {article.author}
                    {article.createdAtLabel ? ` · ${article.createdAtLabel}` : ''}
                    {article.readTime ? ` · ${article.readTime}` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveArticleId(article.id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E3A8A] dark:text-[#93C5FD] hover:text-[#1D4ED8] dark:hover:text-white"
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
          className="fixed inset-0 z-50 bg-[#0D1830]/70 dark:bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setActiveArticleId(null)}
        >
          <div
            className="bg-white dark:bg-[#0D1526] w-full max-w-2xl max-h-[90vh] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl border border-[#E2E6EE] dark:border-[#1E2C4A]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-[#E2E6EE] dark:border-[#1E2C4A] bg-[#F6F7FA] dark:bg-[#091020] flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-[#B85338] dark:text-[#F0947A]">
                {activeArticle.kicker}
              </span>
              <button
                type="button"
                onClick={() => setActiveArticleId(null)}
                aria-label="Close article"
                className="w-10 h-10 rounded-lg border border-[#D4DBE8] dark:border-[#263759] bg-white dark:bg-[#131E36] flex items-center justify-center text-[#131B2E] dark:text-[#F1F5F9] hover:bg-[#EFF3FA] dark:hover:bg-[#1A2A4A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-6 sm:p-8 space-y-5">
              <h2
                className={`font-serif text-xl sm:text-2xl font-bold text-[#131B2E] dark:text-[#F1F5F9] leading-snug ${getScriptFontClass(activeArticle.title)}`}
              >
                {activeArticle.title}
              </h2>
              <p className="text-xs text-[#525E75] dark:text-[#94A3B8] pb-4 border-b border-[#EFF2F7] dark:border-[#1E2C4A]">
                {activeArticle.author}
                {activeArticle.createdAtLabel ? ` · ${activeArticle.createdAtLabel}` : ''}
                {activeArticle.readTime ? ` · ${activeArticle.readTime}` : ''}
              </p>
              <div
                className={`space-y-4 text-[15.5px] leading-[1.9] text-[#1E293B] dark:text-[#CBD5E1] max-w-prose whitespace-pre-line ${getScriptFontClass(activeArticle.body)}`}
              >
                {activeArticle.body}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

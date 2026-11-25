import {Component, ErrorInfo, ReactNode} from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    message: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {hasError: true, message: error.message};
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F6F7FA] dark:bg-[#060B17] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] rounded-2xl p-6 text-center space-y-4 shadow-sm">
            <h1 className="text-lg font-bold text-[#1E3A8A] dark:text-[#93C5FD]">
              စနစ်အတွင်း ယာယီအခက်အခဲ ဖြစ်ပေါ်နေပါသည်
            </h1>
            <p className="text-sm text-[#525E75] dark:text-[#CBD5E1] leading-relaxed">
              စာမျက်နှာကို ပြန်လည်ဖွင့်လှစ်ကြည့်ပါ။ အဆင်မပြေပါက Admin Panel မှတစ်ဆင့်
              ချိတ်ဆက်မှုကို စစ်ဆေးနိုင်ပါသည်။
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-lg bg-[#1E3A8A] dark:bg-[#2563EB] hover:bg-[#172D6B] dark:hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors"
            >
              စာမျက်နှာ ပြန်ဖွင့်ရန်
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

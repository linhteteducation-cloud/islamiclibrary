import {User} from 'firebase/auth';
import {BookCategoryId} from '../types/library';

export interface TelegramConfigStatus {
  tokenConfigured: boolean;
  tokenSource: 'saved' | 'env' | 'none';
  maskedToken: string;
  botUsername: string;
  botFirstName: string;
  allowedChatIds: string;
  autoSyncToWebsite: boolean;
  defaultCategoryId: 'auto' | BookCategoryId;
  lastUpdateId: number;
}

export interface TelegramDiscoveredChat {
  chatId: string;
  title: string;
  type: string;
  username: string;
  pendingPdfCount: number;
}

export interface TelegramUploadedBook {
  driveFileId: string;
  fileName: string;
  fileSize: string;
  title: string;
  telegramMessageId: number;
  chatId: string;
  chatTitle: string;
}

export interface TelegramSyncResponse {
  uploadedBooks: TelegramUploadedBook[];
  skippedCount: number;
  errors: string[];
  lastUpdateId: number;
}

export async function getTelegramConfigStatus(
  user: User,
): Promise<TelegramConfigStatus> {
  const idToken = await user.getIdToken();
  const res = await fetch('/api/telegram/config', {
    headers: {Authorization: `Bearer ${idToken}`},
  });
  const data = (await res.json().catch(() => ({}))) as
    | TelegramConfigStatus
    | {error?: string};
  if (!res.ok) {
    throw new Error(
      'error' in data && data.error
        ? data.error
        : `Telegram စစ်ဆေးမှု မအောင်မြင်ပါ (${res.status})`,
    );
  }
  return data as TelegramConfigStatus;
}

export async function saveTelegramBotConfig(
  user: User,
  payload: {
    botToken?: string;
    allowedChatIds: string;
    autoSyncToWebsite: boolean;
    defaultCategoryId: 'auto' | BookCategoryId;
    lastUpdateId?: number;
  },
): Promise<TelegramConfigStatus> {
  const idToken = await user.getIdToken();
  const res = await fetch('/api/telegram/config', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as
    | TelegramConfigStatus
    | {error?: string};
  if (!res.ok) {
    throw new Error(
      'error' in data && data.error
        ? data.error
        : `Telegram Bot ချိတ်ဆက်သိမ်းဆည်းမှု မအောင်မြင်ပါ (${res.status})`,
    );
  }
  return data as TelegramConfigStatus;
}

export async function disconnectTelegramBotConfig(user: User): Promise<void> {
  const idToken = await user.getIdToken();
  const res = await fetch('/api/telegram/disconnect', {
    method: 'POST',
    headers: {Authorization: `Bearer ${idToken}`},
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as {error?: string};
    throw new Error(
      data.error || `Telegram Bot ချိတ်ဆက်မှု ဖြုတ်သိမ်း၍ မရပါ (${res.status})`,
    );
  }
}

export async function checkTelegramChats(user: User): Promise<{
  chats: TelegramDiscoveredChat[];
  pendingPdfCount: number;
}> {
  const idToken = await user.getIdToken();
  const res = await fetch('/api/telegram/check-chats', {
    method: 'POST',
    headers: {Authorization: `Bearer ${idToken}`},
  });
  const data = (await res.json().catch(() => ({}))) as
    | {chats: TelegramDiscoveredChat[]; pendingPdfCount: number}
    | {error?: string};
  if (!res.ok) {
    throw new Error(
      'error' in data && data.error
        ? data.error
        : `Telegram Chat များ စစ်ဆေးမှု မအောင်မြင်ပါ (${res.status})`,
    );
  }
  return data as {chats: TelegramDiscoveredChat[]; pendingPdfCount: number};
}

export async function syncTelegramPdfsToDrive(
  user: User,
  driveToken: string,
  folderId?: string,
): Promise<TelegramSyncResponse> {
  const idToken = await user.getIdToken();
  const res = await fetch('/api/telegram/sync-to-drive', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      'X-Drive-Token': driveToken,
    },
    body: JSON.stringify({folderId}),
  });
  const data = (await res.json().catch(() => ({}))) as
    | TelegramSyncResponse
    | {error?: string};
  if (!res.ok) {
    const err = new Error(
      'error' in data && data.error
        ? data.error
        : `Telegram မှ Google Drive သို့ တင်သွင်းမှု မအောင်မြင်ပါ (${res.status})`,
    ) as Error & {status?: number};
    err.status = res.status;
    throw err;
  }
  return data as TelegramSyncResponse;
}

import {User} from 'firebase/auth';

export interface BlogspotCatalogItem {
  index: number;
  title: string;
  postUrl: string;
}

export interface BlogspotCatalogResponse {
  sourceUrl: string;
  count: number;
  items: BlogspotCatalogItem[];
}

export interface TransferredBookResult {
  driveFileId: string;
  fileName: string;
  fileSize: string;
  title: string;
  sourceType: 'drive-copy' | 'mediafire-pdf' | 'direct-pdf';
}

export async function fetchBlogspotCatalog(
  user: User,
  sourceUrl: string,
): Promise<BlogspotCatalogResponse> {
  const idToken = await user.getIdToken();
  const res = await fetch('/api/import/catalog', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({sourceUrl}),
  });

  const payload = (await res.json().catch(() => ({}))) as
    | BlogspotCatalogResponse
    | {error?: string};

  if (!res.ok) {
    throw new Error(
      'error' in payload && payload.error
        ? payload.error
        : `စာအုပ်စာရင်း ရယူမှု မအောင်မြင်ပါ (${res.status})`,
    );
  }

  return payload as BlogspotCatalogResponse;
}

export async function transferBlogspotBookToDrive(
  user: User,
  driveToken: string,
  params: {
    postUrl: string;
    bookTitle: string;
    folderId?: string;
  },
): Promise<TransferredBookResult> {
  const idToken = await user.getIdToken();
  const res = await fetch('/api/import/transfer-book', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      'X-Drive-Token': driveToken,
    },
    body: JSON.stringify(params),
  });

  const payload = (await res.json().catch(() => ({}))) as
    | TransferredBookResult
    | {error?: string};

  if (!res.ok) {
    const err = new Error(
      'error' in payload && payload.error
        ? payload.error
        : `PDF ကူးယူတင်သွင်းမှု မအောင်မြင်ပါ (${res.status})`,
    ) as Error & {status?: number};
    err.status = res.status;
    throw err;
  }

  return payload as TransferredBookResult;
}

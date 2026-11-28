# Firestore Security Specification (Phase 0)

## 1. Data Invariants
- Every document in `/books`, `/duas`, `/videos`, `/articles`, and `/siteSettings` can only be created, updated, or deleted by an authenticated, email-verified Admin (`isAdmin()`).
- Public readers can read published `/books` (`resource.data.published == true`) or Admins can read all `/books`.
- All `/books` documents must contain valid `https://` Google Drive URLs (`driveViewUrl`, `driveDownloadUrl`) and a valid `driveFileId` matching `^[a-zA-Z0-9_\-]+$`.
- `/siteSettings/main` allows strict optional `contactLinks` map with bounded `https://` URLs (`facebook`, `telegram`, `youtube`, `whatsapp`, `github`, `website`), email, and phone string formats (preventing `javascript:` / `data:` URL injection).
- `/contactMessages` allows public `create` with strict field validation (`status == 'unread'`, `createdAt == request.time`, bounded sizes), while `get`, `list`, `update`, and `delete` are strictly restricted to `isAdmin()` so visitor contact PII cannot be read by other users.
- `/fatwaQuestions` allows public `create` with strict validation (`status == 'pending'`, empty answer fields, valid Email/Phone/Viber formats), while `get`, `list`, `update`, and `delete` are strictly restricted to `isAdmin()` so asker Name, City, Email, Phone, and Viber No PII never leaks.
- `/publishedFatwas` contains zero PII and allows public reads, while only Admins can create/update/delete published answers.
- `/fatwaCategories` allows public reads and strictly Admin-only writes/deletes.
- `/duaSlides` allows public reads only for `published == true` slides and restricts `imageUrl` to `https://` or safe PNG/JPEG/WebP/GIF base64 payloads (`<= 850KB`), with Admin-only writes/deletes.
- `createdAt` and `uploadedByUid` / `createdByUid` are immutable after creation; `createdAt` and `updatedAt` must equal `request.time`.

## 2. Adversarial Test Payloads ("Dirty Dozen")
1. **Unauthenticated Book Create**: Unauthenticated client posts to `/books/bk1` -> `PERMISSION_DENIED`.
2. **Non-Admin Book Create**: Signed-in user with `email != 'linhteteducation@gmail.com'` and no `/admins/{uid}` doc writes to `/books/bk1` -> `PERMISSION_DENIED`.
3. **Unverified Admin Email Spoof**: Signed-in user with `email == 'linhteteducation@gmail.com'` and `email_verified == false` writes to `/books/bk1` -> `PERMISSION_DENIED`.
4. **Ghost/Shadow Field Injection**: Admin writes `/books/bk1` with extra field `isFeaturedSuper: true` -> `PERMISSION_DENIED` (`keys().hasOnly(...)`).
5. **JavaScript URL XSS Injection**: Admin writes `/books/bk1` with `driveViewUrl: "javascript:alert(1)"` -> `PERMISSION_DENIED` (`matches('^https://.*$')`).
6. **Oversized String Poisoning**: Admin writes `/books/bk1` with 10,000-char `title` -> `PERMISSION_DENIED` (`title.size() <= 240`).
7. **Invalid Document ID Poisoning**: Admin writes `/books/bad..id` -> `PERMISSION_DENIED` (`isValidId`).
8. **Timestamp Forgery on Create**: Admin writes `/books/bk1` with backdated `createdAt` != `request.time` -> `PERMISSION_DENIED`.
9. **Immutable Field Tampering on Update**: Admin updates `/books/bk1` modifying `createdAt` or `uploadedByUid` -> `PERMISSION_DENIED`.
10. **PII Leak via Contact Messages List**: Non-admin reads or lists `/contactMessages` -> `PERMISSION_DENIED`.
11. **Contact Message Status Spoof on Create**: Visitor creates `/contactMessages/msg1` with `status: 'read'` -> `PERMISSION_DENIED`.
12. **Self-Assigned Admin Escalation**: Non-admin writes to `/admins/{theirUid}` -> `PERMISSION_DENIED`.

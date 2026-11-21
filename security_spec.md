# EDraw Firestore Security Specification

## Data Invariants
1. **Strict Owner Isolation (PII Protection)**: `/students/{studentUid}` contains PII (`email`, `name`, `college`, `studentDetails`). Only the authenticated, email-verified user whose `request.auth.uid == studentUid` may read, create, update, or delete their own document. Blanket `list` queries on `/students` are forbidden.
2. **Master Gate on Subcollections**: `/students/{studentUid}/progress/{progressId}` requires the parent `/students/{studentUid}` document to exist and belong to `request.auth.uid`.
3. **Immutable Identity & Verification Fields**: `uid`, `edrawId`, `email`, `verified`, `registrationStatus`, `emailVerifiedAt`, and `createdAt` are immutable after creation. Clients cannot self-verify or alter their allocated `edrawId`, `verified`, or `registrationStatus`.
4. **Server Timestamps Only**: `createdAt`, `updatedAt`, and `emailVerifiedAt` must equal `request.time` on creation, and `updatedAt` must equal `request.time` on updates.
5. **Format & Size Enforcement**: `edrawId` must match `^EDID-[0-9]{4}$`, `email` must match `^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`, `registrationStatus` must equal `'verified'`, and all strings/arrays have strict `.size()` bounds.
6. **No Shadow Fields**: `hasAll` + `hasOnly` on create and `affectedKeys().hasOnly(['name', 'college', 'studentDetails', 'updatedAt'])` on update block undeclared fields and privileged mutations.

## Dirty Dozen Adversarial Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated read of `/students/uid_a`**: No auth token present.
2. **Cross-user PII read**: Authenticated user `uid_b` attempts `get` on `/students/uid_a`.
3. **Collection scraping (`list`)**: Authenticated user attempts `list` on `/students`.
4. **Unverified email write**: Authenticated user with `email_verified: false` attempts `create` on `/students/uid_a`.
5. **UID spoofing on create**: Authenticated `uid_a` attempts to write `uid: "uid_b"` inside `/students/uid_a`.
6. **Shadow field injection**: Create/update payload includes extra ghost field `isAdmin: true` or `role: "admin"`.
7. **Invalid `edrawId` format**: Create payload supplies `edrawId: "ADMIN-9999"` instead of `EDID-XXXX`.
8. **Immutable `edrawId` or `registrationStatus` mutation**: Update payload attempts to change `edrawId`, `verified`, `registrationStatus`, or `emailVerifiedAt`.
9. **Client-forged timestamp**: Create payload supplies client date instead of `request.time`.
10. **Oversized string / ID poisoning**: Document ID > 128 chars or `college` > 120 chars.
11. **Orphaned progress write**: User writes `/students/uid_a/progress/default` before parent `/students/uid_a` exists.
12. **Unbounded array / value poisoning**: Progress update submits `completedModules` with 25 items or non-string first element.

# Firestore Zero-Trust Security Specification (`Purr'Coffee POS`)

## 1. Data Invariants
1. **Default-Deny Catch-All**: Any path not explicitly matched is unconditionally denied (`allow read, write: if false;`).
2. **Verified Identity Gate**: Every write operation across all collections requires `request.auth != null && request.auth.token.email_verified == true`.
3. **Bootstrapped Admin & Zero Client-Claim Trust**: Admin status is strictly derived from `exists(/databases/$(database)/documents/admins/$(request.auth.uid))` OR verified runtime email (`request.auth.token.email == 'ornandosaputra0@gmail.com' && request.auth.token.email_verified == true`). Client-supplied role claims are never trusted.
4. **PII Split Isolation**: User email PII resides solely in `/users/{userId}/private/{docId}` and is strictly readable only by `request.auth.uid == userId || isAdmin()`.
5. **Relational Master Gate on Subcollections**: `/orders/{orderId}/line_items/{lineId}` verifies parent `/orders/{orderId}` ownership synchronously via `get(/databases/$(database)/documents/orders/$(orderId)).data.ownerId == request.auth.uid` AND atomic parent existence via `existsAfter(...)` on creation.
6. **Immutable Ownership & Temporal Integrity**: `ownerId` and `createdAt` can never be mutated during updates; `createdAt` on create and `updatedAt` on create/update must equal `request.time`.
7. **Terminal State Locking**: Once an `Order` reaches `status == 'refunded'`, no non-admin updates are permitted.
8. **Query Enforcer**: Every `allow list` rule enforces `resource.data.ownerId == request.auth.uid` without `get()`/`exists()` inside `list`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unverified Admin Email Spoof**: `{ auth: { uid: "attacker1", email: "ornandosaputra0@gmail.com", email_verified: false } }` attempting `create` on `/products/prod_1` -> `PERMISSION_DENIED`.
2. **Owner Identity Spoofing on Create**: `{ auth: { uid: "user_a", email_verified: true }, data: { ownerId: "user_b", ... } }` on `/products/prod_1` -> `PERMISSION_DENIED`.
3. **Shadow / Ghost Field Injection**: Valid product payload plus `{ isSuperAdmin: true }` on `/products/prod_1` -> `PERMISSION_DENIED` (`hasOnly` check).
4. **Update-Gap Value Poisoning**: Updating whitelisted `stock` field on `/products/prod_1` with `"unlimited"` (string instead of bounded int) -> `PERMISSION_DENIED` (`isValidProduct` wrapper on `update`).
5. **ID Poisoning Attack**: Creating `/products/bad$id/with spaces!` -> `PERMISSION_DENIED` (`isValidId` regex guard).
6. **Client Timestamp Forgery**: Creating `/orders/ord_1` with `createdAt` set to past timestamp (`request.time - 3600s`) -> `PERMISSION_DENIED`.
7. **Immortal Field Mutation**: Updating `ownerId` or `createdAt` on `/products/prod_1` -> `PERMISSION_DENIED`.
8. **Terminal State Re-opening**: Updating `/orders/ord_1` from `status: "refunded"` back to `status: "completed"` as regular owner -> `PERMISSION_DENIED`.
9. **Orphaned Subcollection Line Item**: Creating `/orders/nonexistent_order/line_items/li_1` without parent `/orders/nonexistent_order` -> `PERMISSION_DENIED`.
10. **Cross-Tenant PII Leak**: Authenticated `user_b` attempting `get` on `/users/user_a/private/info` -> `PERMISSION_DENIED`.
11. **Unfiltered Blanket Collection List Scrape**: Authenticated `user_b` issuing unfiltered `list` across `/orders` containing `user_a` records -> `PERMISSION_DENIED`.
12. **Self-Assigned Admin Escalation**: Authenticated `user_b` attempting `create` on `/admins/user_b` -> `PERMISSION_DENIED`.

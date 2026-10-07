## 2024-03-20 - Missing ARIA labels in common UI patterns
**Learning:** Icon-only close buttons in modals and dynamic array form controls (e.g. "remove row" icons) are frequently implemented without `aria-label` attributes across different components in this codebase.
**Action:** Always verify icon buttons such as `X` and `Trash2` inside modals or list components when looking for accessibility improvements.

## 2026-10-01 - Add aria-labels to ConfigBloqueCard
**Learning:** Found an accessibility issue specific to this app's components.
**Action:** Added `aria-label` attributes to icon-only buttons to improve screen-reader accessibility.

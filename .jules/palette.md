## 2024-03-20 - Missing ARIA labels in common UI patterns
**Learning:** Icon-only close buttons in modals and dynamic array form controls (e.g. "remove row" icons) are frequently implemented without `aria-label` attributes across different components in this codebase.
**Action:** Always verify icon buttons such as `X` and `Trash2` inside modals or list components when looking for accessibility improvements.

## 2026-10-01 - Add aria-labels to ConfigBloqueCard
**Learning:** Found an accessibility issue specific to this app's components.
**Action:** Added `aria-label` attributes to icon-only buttons to improve screen-reader accessibility.
## 2024-10-09 - Accessible Icon Buttons
**Learning:** Found multiple instances where close modal buttons (`X` icon) lacked accessibility attributes, making them confusing for screen reader users. Reusing the same `aria-label="Cerrar modal"` pattern across different modal headers ensures consistency.
**Action:** Always scan for icon-only buttons using regular expressions or scripts when reviewing UI components, and explicitly add `aria-label` whenever `children` is an SVG/Icon and lacks visible text.

## 2026-10-17 - Accessible names include visible labels
**Learning:** An `aria-label` overrides a button's visible text. If it omits that text, voice-control users may not be able to target the button by the label they see (WCAG 2.5.3, Label in Name).
**Action:** Make accessible names contain the visible label, update them when button text changes, and omit redundant `aria-label` values when visible text already provides the name.

## 2024-10-27 - Focus States on Custom Icon Buttons
**Learning:** Custom icon buttons outside standard reusable UI components frequently lack keyboard focus states in this design system.
**Action:** Verify and add focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color] Tailwind classes to ensure proper keyboard accessibility when reviewing custom UI components.

## 2026-10-08 - Added ARIA labels to ConfigBloqueFormModal
**Learning:** Found multiple icon-only buttons missing aria-labels (e.g. closing modal, deleting blocks). Adding `aria-label` improves screen reader support significantly.
**Action:** Always check if a button without text has an `aria-label` or `title`, particularly when using icon libraries like `lucide-react`.

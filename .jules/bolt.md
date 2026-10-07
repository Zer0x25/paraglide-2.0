## 2024-05-14 - Admin Users API Request Debouncing
**Learning:** In `apps/web/src/app/admin/users/hooks/useAdminUsersController.ts`, the `q` (search query) state is tied directly to the `queryParams` `useMemo`, which immediately triggers a new API request on every keystroke through the `useQuery` because `q` is mapped to `queryParams.q`. The `q` state is set synchronously on `onChange` via `c.setQ(e.target.value)`. This causes excessive API calls when typing in the user search field.
**Action:** Implement debouncing for API calls triggered by search inputs to avoid an excessive number of server requests. The codebase already implements manual debouncing using `useRef` and `setTimeout` in other files (e.g. `useReservasController.ts`), so we can follow this pattern.

## 2024-10-01 - Batch update optimization in Prisma
**Learning:** Sequential Prisma updates inside a transaction (an N+1 pattern) cause unnecessary sequential I/O latency.
**Impact:** Using `Promise.all()` to dispatch mutations concurrently reduces latency from O(N) to roughly O(1) in terms of network RTT (measured in benchmark from multiple loops taking higher times compared to concurrent batching).

## 2024-10-05 - Batch independent DB queries
**Learning:** Found sequential DB queries in metricas.routes.ts where `pilotosTopRaw` was being executed *after* a `Promise.all()` that fetched other unrelated metrics for the same date range. This caused a waterfall effect.
**Action:** Move independent queries into the same `Promise.all()` block when possible to execute them concurrently, especially in reporting/dashboard endpoints where many aggregates are fetched simultaneously.

## 2025-01-20 - Fast Array Lookups in Nested Loops
**Learning:** Nested array lookups (e.g. `Array.find` inside a loop) can quickly degrade performance to O(N^2).
**Action:** When searching an array iteratively for elements matching varying criteria, precompute Map or Dictionary structures based on the key identifiers to allow for O(1) lookups. When matching on multiple optional fields (like Name OR ID), separate lookup maps should be created for each criterion. Take care not to use exclusive logic (if/else) when populating the Maps if the entity might match against different criteria independently.

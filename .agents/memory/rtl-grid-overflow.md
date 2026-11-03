---
name: RTL grid overflow
description: Diagnose mobile overflow from intrinsic grid tracks rather than hiding it or blaming map panes.
---

Use explicit zero-minimum grid tracks on mobile as well as desktop, and `min-width: 0` on direct grid children when they contain flex rows, native selects or one-line doctor labels.

**Why:** an implicit mobile `auto` track can expand to its descendants' minimum content width even when the grid itself fits the viewport. Truncated links inside flex rows do not necessarily prevent this. In RTL the resulting page-wide clipping can look like a Leaflet sizing problem.

**How to apply:** compare document scroll/client widths, then inspect overflowing element bounds and computed grid track sizes. Fix the responsible track/item, not by hiding body overflow. Keep the existing desktop column layout and verify all links remain reachable.

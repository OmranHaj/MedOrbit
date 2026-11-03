---
name: Motion dependencies and stale Vite previews
description: Distinguish dependency-optimization hot-reload errors from actual React hook bugs.
---

After adding motion dependencies while Vite is serving, an existing preview tab can retain modules from the previous dependency optimization and report an invalid hook call.

**Why:** this occurred during hot updates, while a fresh browser document after the managed frontend restart rendered correctly and the app and Framer Motion resolved the same React instance.

**How to apply:** check React resolution and a fresh document before changing hook structure or adding dependency overrides. Restart the existing managed frontend workflow after the dependency batch; do not create a duplicate server. A persisted error boundary in an older tab may still need a full page reload.

---
name: GitHub upload access
description: Non-obvious GitHub access behavior and a safe alternative for repository uploads.
---

A GitHub connector can appear authorized yet remain unavailable to sandbox connection calls in this project. Do not keep requesting authorization or look for token values.

**Why:** Attaching the authorized connector still returned no usable connection, while a normal HTTPS Git operation against the user-specified repository succeeded through Replit's supported Git provider proxy.

**How to apply:** For repository upload requests, consult the current Replit documentation on the secure Git provider proxy and use ordinary Git operations against the explicitly authorized repository. Read remote state first; never force-push or overwrite unrelated remote history. Keep credentials outside the agent context.

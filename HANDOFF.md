# Overstory branch-animation redo — handoff

Last updated: 2026-07-02

## Goal
Redo the branch animation on the **method section (section 02 "The method")** of Overstory Labs
(https://overstory-six.vercel.app/). The current branch grows down the method gutter as you scroll,
one leaf per step (5 steps: Sit → Diagnose → Build → Hand off → Leave).

## Decision (locked)
- **Direction chosen: "Elevated GSAP"** — keep the existing procedural-SVG + GSAP ScrollTrigger engine
  (so leaves stay anchored to the real `<li>` steps and it reflows to any height). Do NOT switch to
  Lottie (baked, can't anchor to DOM steps) or Motion (React; site is vanilla). Rive was the only true
  "more advanced system" but loses per-step DOM anchoring — rejected.
- Rationale routed via the `animate` skill: pick the tool that reaches the quality ceiling, not the
  flashiest-sounding one. For a DOM-anchored, reflowing, scroll-grown branch, SVG + GSAP is correct;
  the fix is motion design, not a tech swap.

## User's requested tweaks to the Elevated version (DONE)
1. **No sway** — removed the idle pendulum/wind loop (and its off-screen observer).
2. **All leaves on the RIGHT** of the shaft (toward content), not alternating. Implemented as
   `side = (ux < 0) ? -1 : 1` so leaves always seat toward +x.
   ⚠️ UNVERIFIED VISUALLY — if leaves come out on the wrong side, flip that sign (one char).
3. **No double branch** — mount is now idempotent (strips any existing `svg.branch-spine` before insert).

## Where the work lives
- Demo repo: **github.com/zkiihne/overstory-branch-demo** (created this session, public).
- Files: `index.html` (4-panel switcher: Current / Elevated GSAP / Rive / Lottie),
  `branch-current.js` (fetched copy of the live `branch-spine.js`),
  **`branch-elevated.js`** (the deliverable — the reworked branch).
- Latest commit at handoff: the "remove sway, leaves right, idempotent mount" commit on `main`.

## Live preview links (all serve the fixed Elevated version)
- GitHub Pages (renders properly): **https://zkiihne.github.io/overstory-branch-demo/**
- githack: https://raw.githack.com/zkiihne/overstory-branch-demo/main/index.html
- Open the "Elevated GSAP" tab and scroll down to grow the branch.

## Verification status
- **Motion NOT verified in a browser by the agent** — no Playwright; headless Chrome hung on this box
  (known-unreliable here). Static checks passed (balanced brackets, mount fns wired, files serve 200).
- The live links ARE the visual check — confirm leaf side + overall feel in a real browser.

## Open blockers / next steps
1. **Vercel deploy is blocked in the CLI/agent session**: no `vercel` binary, no npm/node to install it,
   no `VERCEL_TOKEN` in env, and the Vercel MCP exposes no headless deploy tool. To put the DEMO on Vercel:
   either add `export VERCEL_TOKEN=...` to `~/.zshenv` (then import the repo via REST API), OR import
   `zkiihne/overstory-branch-demo` once in the Vercel dashboard (New Project → import → Deploy).
   (Not required — Pages already works for review.)
2. **REAL integration still pending**: locate the actual Overstory source repo (NOT found on this machine
   by name; suspected to be `~/projects/ai-foundation` rebranded, but that lookup was interrupted/unverified).
   Once found: replace its `branch-spine.js` with `branch-elevated.js` (rename the mount call
   `mountBranchSpineElevated` → whatever the site calls, or swap the file and keep the `mountBranchSpine`
   name), then deploy the real site to Vercel (`vercel --prod` ships the working tree; also commit).

## To resume in a new chat, say:
"Continue the Overstory branch redo — read HANDOFF.md in the overstory-branch-demo repo. Elevated GSAP is
chosen and tweaked; find the real Overstory source and port branch-elevated.js in, then deploy to Vercel."

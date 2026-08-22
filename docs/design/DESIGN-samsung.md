---
version: alpha
name: One UI (Samsung) Design Analysis
description: An analysis of Samsung's One UI design system — the official Android design language for Galaxy devices. Built on four principles (focus on the task, interact naturally, be visibly comfortable, make things responsive), it favors calm monotone surfaces, one confident system blue as the primary action color, generous 18dp button rounding, blur/dim/shadow for depth (never heavy shadow), and a clear split between a passive "viewing area" (top) and an actionable "interaction area" (bottom) on every screen.

source: https://developer.samsung.com/one-ui/ — all 33 sub-pages under Structure, Layout, Components, Color, Iconography, Motion, Sound & Haptic, Writing, Accessibility, and Large screen & Foldable were read (2026-08-22). This is a **mobile OS design system** (Android/Galaxy), not a web marketing site — units are dp (density-independent pixels), not px, and several visual specs (exact grays, font family, spacing scale) are only shown as images/video on the source pages and are not recoverable as text. Anything not explicitly published is marked as such below rather than invented.

colors:
  primary-dark-light: "#0072de"
  primary-dark-dark: "#3e91ff"
  primary: "#0381fe"
  control-activated: "#3e91ff"
  ink-dark-mode-note: "not published as hex — dark mode turns backgrounds/menus black or dark gray"
  ink-light-mode-note: "not published as hex — backgrounds use calm, simple monotone colors"

typography:
  note: "Font family and exact type scale are not published as text on these docs (shown only in images/video). One UI's known production typeface is the proprietary SamsungOne / SamsungSharpSans family — stated here as outside-document background, not sourced from these pages."
  list-main-text-max-chars: 31
  contrast-small-text-min: "4.5:1"
  contrast-large-text-min: "3:1"
  large-text-threshold: "≥18dp normal weight or ≥14dp bold"

rounded:
  button: 18dp
  app-icon: "rounded square (exact radius not published)"

spacing:
  side-margin-min: 24dp
  app-bar-max-actions: 3
  bottom-bar-max-actions: 5
  bottom-nav-max-tabs: 5
  bottom-nav-recommended-tabs: 4

components:
  app-bar:
    forms: "condensed (standard height) and extended (taller, more info)"
    behavior: "extended app bar condenses on scroll-down, re-expands on scroll-up; state persists across app re-entry"
    slots: "Back · Title (dynamic title optional) · up to 3 action buttons · More options overflow"
  bottom-bar:
    maxActions: 5
    rule: "if more than 4 needed, show 4 most-used + More options overflow; never show a single lone action"
  bottom-navigation:
    maxTabs: 5
    recommendedTabs: 4
    rule: "text-only tabs, no swipe-to-switch between tabs"
  button-flat:
    background: "none"
    use: "low emphasis; toolbars and dialogs to avoid extra visual layers"
  button-contained:
    background: "gray = medium emphasis, brand color = high emphasis"
    rounded: "{rounded.button}"
  dialog:
    choice-confirm-position: "bottom of screen"
    info-progress-position: "center of screen"
    dismiss: "stays open until user chooses, taps Back, or taps outside"
  list:
    mainTextMaxChars: "{typography.list-main-text-max-chars}"
    toggle-position: "right side of row, when setting is on/off"
    subheader: "used to visually group related settings/menus"
  search:
    features: "auto-complete + predictive text; pre-type suggestions from recent searches/context"
  toast:
    maxLines: 3
    variants: "plain toast (info only) · label toast/tooltip (icon long-press) · snack bar (adds one follow-up action button)"

---

## Overview

One UI is Samsung's Android design system for Galaxy phones, tablets, watches, foldables, and PCs. Unlike a marketing site, its guidelines are written for **product designers building OS-level and first-party app screens**, so the vocabulary is structural rather than promotional: viewing area vs. interaction area, focus blocks, reject/grip zones, window size classes. Four principles govern everything: **focus on the task at hand** (simple designs, short journeys), **interact naturally** (natural motion, reachable controls), **be visibly comfortable** (Dark mode, high contrast, variable font sizes), and **make things responsive** (adapts to any screen size and to the user).

The visual mood is calm and restrained compared to a consumer marketing site: monotone backgrounds carry most of the UI, and a single confident system blue (`{colors.primary-dark-light}` in light mode, `{colors.primary-dark-dark}` in dark mode) is reserved for the handful of things that matter — contained-button fills, subtext emphasis, FABs, sliders, and activated controls. Depth comes from **blur, dim, and shadow**, used lightly and never combined, rather than from heavy elevation shadows. Corners are soft (18dp on buttons, rounded squares on app icons) but not maximalist — nothing reaches Discord-style jumbo radii.

**Key characteristics:**
- One system blue does almost all the color work; backgrounds stay calm and monotone in both Light and Dark mode.
- Every screen splits into a **viewing area** (top, look-only, center-aligned text) and an **interaction area** (bottom, actionable, grouped by grid type: list / card / 2-col / 3-col).
- Depth = blur + dim + shadow, applied one at a time, never stacked — explicitly warned against for "visual fatigue."
- 18dp button corner radius; 24dp minimum side margins to clear curved-edge screens; a Reject Zone / Grip Zone blocks accidental touches.
- Component ceilings are numeric and strict: ≤3 app-bar actions, ≤5 bottom-bar actions, ≤5 (ideally 4) bottom-nav tabs, ≤31-char list labels, ≤3-line toasts.
- Writing voice: one choice per screen, no defensive/warning text unless truly needed, explain trade-offs, inclusive language (singular "they").
- Accessibility is load-bearing, not an appendix: 4.5:1 / 3:1 contrast minimums, screen-reader four-part audible feedback (status → name → type → hint), text scalable to 200%.
- Large-screen/foldable guidance is a first-class section: multi-pane layouts with published breakpoint ratio tables, navigation shape tied to window size class, flex-mode continuity for foldables.

## Colors

> Source pages: `color/system.html`, `color/theme.html`. Exact neutral/gray hex values for backgrounds are not published as text (shown only in screenshots) — treat the notes below as directional, not literal tokens.

### Brand
- **Primary dark** (`{colors.primary-dark-light}` light / `{colors.primary-dark-dark}` dark): background of contained buttons; subtext color. "Blue symbolizes trust, hope, and stability... a key part of Samsung's heritage and brand identity."
- **Primary** (`{colors.primary}`, same value both themes): floating action buttons, sliders.
- **Color control activated** (`{colors.control-activated}`, same value both themes): checkboxes and other "activated" control states.

### Background & Surface
- Backgrounds use "simple, calm colors that are visually comforting" — deliberately not decorative.
- **Default mono tone**: focus blocks (settings/image/content groupings) use monotone fills in both Light and Dark mode; an "alternative" variant fills focus blocks with full-bleed images instead.
- **Gradients** are used sparingly — either a detailed pattern or a combination of analogous colors — and explicitly *not* the default; the doc calls out avoiding "a blue screen of death" via warm gradients only on full-bleed screens.
- Three **focus-block color types**: Type 1 (standard monotone, most common — function-driven content like message lists), Type 2 (light app-scheme colors for on/off toggles, brightness-adjusted per theme), Type 3 (gradation — flagged "use with caution," can look complex/distracting).

### Theme (Light / Dark)
- Both modes require text/background contrast to stay clearly readable, while background-to-focus-block contrast stays gentle for visual comfort.
- Dark mode turns backgrounds, menus, and UI elements black or dark gray to cut glare (especially useful at night) — but can make images/content look jarring, so "test apps and features in both Light and Dark modes before release."

## Typography

No font family or numeric type scale is published as text on these docs (only shown in video/screenshots). What *is* explicit:

- List main text should stay within **31 characters** to avoid a second line; longer content becomes subtext or moves to a detail page.
- Text should be **resizable up to 200%** without breaking layout or losing function (except subtitles/text-in-images).
- Minimum contrast: **{typography.contrast-small-text-min}** for small text, **{typography.contrast-large-text-min}** for large text ({typography.large-text-threshold}).
- Center-aligned text is used specifically in the top "viewing area" to give the screen visual stability before the user moves down into the interaction area.

*(Outside-document note: One UI's production typeface is Samsung's proprietary **SamsungOne** / **SamsungSharpSans** family — known from Samsung's broader brand materials, not from these specific pages. For a web rebuild, a clean geometric humanist sans — e.g. Pretendard (already used in this repo), Inter, or Noto Sans KR — is the closest open substitute.)*

## Layout

### Viewing area vs. interaction area
Every screen splits top-to-bottom:
- **Viewing area** (top): wide margins, look-only content, center-aligned text, no touch components. A "simple cut out" (straight line) separates any image here from the interaction area below.
- **Interaction area** (bottom): actionable components, grouped logically, laid out on one of four **grid types** — List, Card, 2-Column, 3-Column — chosen per-screen based on content.

### Focus blocks
Content groups by category for at-a-glance scanning, in three shapes: **card** (multiple items), **list** (multiple items, list form), **image** (one item as a full image). Multiple-card focus blocks have documented sub-patterns: image+text (divided), image+text (full-bleed background), image+text (caption below), text-only (3+ lines of body copy), clustered images+text.

### Grid specification
- **Keyline/margin**: ≥{spacing.side-margin-min} on both left and right, to clear curved-edge screens and corners.
- **Reject Zone & Grip Zone**: touches are deliberately blocked in the margins — Reject Zone stops accidental interaction-area touches, Grip Zone stops palm/three-finger touches from simply holding the phone.
- **Cutout area**: content is optimized to avoid camera-cutout regions, with explicit do/don't guidance for 90° and 270° cutout placements.
- **Multi-device**: One UI ships one layout system tuned across phones, tablets, foldables, DeX external-monitor mode, and split-screen — not a single fixed canvas.

## Elevation & Depth

One UI explicitly prefers **blur, dim, and shadow** over heavy elevation shadows, and warns against combining them:

| Effect | Purpose | Rule |
|---|---|---|
| Blur | Emphasizes current screen while keeping a visual link to the previous one | Apply evenly across the background; pair with dim (light-dim in Light theme, dark-dim in Dark theme) rather than using alone — too weak loses distinction, too strong loses hierarchy |
| Dim | Clarifies hierarchy levels, focuses attention on the top layer | Apply evenly across screens for a natural transition; never expose multiple structure levels on one screen |
| Shadow | Shows connection between layered info without implying 3D depth | Keep light and clean — high shadow/background contrast overpowers focus; never combine shadow + dim (raises visual fatigue) |

**Screen transition rule**: if a new screen is unrelated to the previous one, blur+dim the old screen; if closely related, use shadow only so the two feel connected.

## Shapes

- **Button radius**: {rounded.button} (from the shipped Android drawable XML — `android:radius="18dp"` on both the button mask and background).
- **App icons**: rounded-square background with smooth corners and an outline — big enough to hold a clear symbol, soft enough to feel "inviting." Exact corner radius isn't published as a number.
- **Icon symbols**: simple, solid, complete shapes; consistent visual weight/proportion across the icon set. Backgrounds are usually one solid bright color (white symbol on top for contrast); gradients are allowed only as ≤3 analogous colors, and only to preserve a pre-existing app identity.

## Components

### App bar (`components.app-bar`)
Two forms — condensed (default, more content visible) and extended (more room for title/info, pulls actions down near the thumb). Extended auto-condenses on scroll-down and re-expands on scroll-up; state is remembered when the user returns to the app. Optional **dynamic title** replaces the app name with a live status sentence (e.g. unread count, next alarm). Up to **{spacing.app-bar-max-actions} action buttons**; a **More options** overflow menu holds the rest, using checkboxes to show on/off state.

### Bottom bar (`components.bottom-bar`)
Secondary spot for action buttons — especially edit/move/delete after a selection. Can auto-hide on scroll-down for immersion, reappear on scroll-up. Max **{spacing.bottom-bar-max-actions}** buttons (icon + text, never icon-only); beyond that, show the 4 most-used + overflow. **Never show just one lone button.**

### Bottom navigation (`components.bottom-navigation`)
Text-only tabs, **no swipe-to-switch** — Material's swipeable tabs are explicitly not used. Fewer than 4 tabs typical, **{spacing.bottom-nav-max-tabs} absolute max**. When tabs are present, the screen's top title can be omitted (the active tab's label serves as the heading).

### Buttons (`components.button-flat`, `components.button-contained`)
Only **one button style per screen**. **Flat** (no background) = low emphasis, used in toolbars/dialogs to avoid extra visual layers. **Contained** (filled) = gray background for medium emphasis, brand-color background for high emphasis. Shared corner radius: **{rounded.button}**.

### Dialog (`components.dialog`)
Choice/confirmation dialogs anchor to the **bottom** of the screen; information dialogs (e.g. progress) center. A decision dialog stays open until the user picks an option, hits Back, or taps outside it. Long-press on a list item opens an untitled dropdown context menu.

### Lists (`components.list`)
Main text: clear noun/short-verb phrasing, **≤{typography.list-main-text-max-chars}** (31 chars) to avoid wrapping; add subtext only when a setting needs explanation, otherwise push detail to its own page. On/off settings get a **toggle switch on the right**. **Subheaders** group related rows visually.

### Search (`components.search`)
Every search box supports **auto-complete and predictive text**, matching both literal terms and related concepts (e.g. searching "Music" also surfaces Spotify). Before typing, the field pre-populates with recent searches and context-specific suggestions (Finder → recent apps/settings, Settings → useful tags, My Files → recent files).

### Toasts (`components.toast`)
Plain toast: brief, ≤**{components.toast.maxLines}** lines, minor info only — anything requiring a decision or warning about health/data/privacy uses a popup instead, not a toast. **Label toast** (tooltip): appears on long-press of an icon-only button, to compensate for the missing text label. **Snack bar**: like a toast but adds one follow-up action button on the right; still self-dismisses after a few seconds or on tap-elsewhere.

## Iconography

- **Background**: rounded-square, smooth corners, outline — enough room for a clear symbol, soft enough to feel inviting.
- **Symbol**: simple, solid, complete; matches the visual weight/proportion of the rest of the icon set; metaphorical or literal representation of the app's function.
- **Color**: bright, vibrant solid background + white symbol = brand identity + confidence. Gradients allowed only as ≤3 analogous colors, only to preserve legacy app identity.

## Motion

- Purpose: emotionally engage users and make cause-and-effect between actions obvious — not decoration.
- Feedback is driven by *how* the user is touching the screen and *what* is happening, combined with color/shape/depth so motion reads as "simple and intuitive."
- **Screen transitions harmonize with spatial structure**: e.g. Always-On-Display elements slide away to reveal the Lock screen, which then zooms away to reveal Home. New foreground content dims/blurs the old screen so focus shifts naturally (this is the motion counterpart of the Elevation & Depth rules above).
- **Non-interrupted motion**: pinch-to-zoom on a gallery grid, scroll on a contact detail view — the interface itself embodies the gesture rather than reacting after the fact.
- **Crossfades**: for **images**, start fading the new one in *before* the old one fully disappears (avoids a flash of empty background). For **text**, do the opposite — wait for the old text to fully disappear before the new text fades in (overlapping text reads as busy/lowers readability).

## Sound & Haptic

- Use only when necessary — irritating users with unnecessary sound/vibration is explicitly called out as a failure mode.
- **Sound**: fast, clear, immediate feedback (e.g. keyboard sounds), tuned for frequency/length to minimize auditory fatigue; distinct sounds for input vs. cancel/delete actions to prevent mistakes; sound harmonizes with motion and haptic rather than existing in isolation.
- **Haptic**: tuned to real human vibration-perception thresholds (detection, intensity discrimination, frequency, duration-dependent thresholds). Rich, "analog" metaphors over simple buzzes — e.g. a bounce sensation for general vibrate mode, two quick pulses for a failed fingerprint scan, camera-app haptics that mimic a physical shutter/zoom.

## Writing

### Focused and purposeful
Every string must help the user **make a choice, take an action, or understand what's happening** — anything else is cut. Limit each screen to one choice/task at a time, even if it costs a few extra steps. When presenting a choice, show only the information needed to make *that* choice — no long explanations of things unreachable from the current screen. Never leave a dead end: an empty page gets a clear action (a bright button, or at least a path back). Explain technical settings in terms of trade-offs the user actually cares about, not implementation detail.

### Simple and human
**Remove defensive text** — don't warn about things that aren't an immediate concern; if the app can fix an issue automatically, it does, silently. **Only interrupt for real decisions**: popups are reserved for data input, delete confirmation, consent, or critical info — everything else is a toast or similar low-friction surface. **Show benefits, not mechanics**: "Samsung Health helps you track your meals, workouts, and other important health metrics" (user-focused) beats "Samsung Health captures and tracks health related information and metrics" (feature-focused). **Inclusive language**: avoid region/culture/gender-specific references; singular "they" throughout, never "he/she."

### Empowering and engaging
Phrase confirmations as genuine **questions** (feels conversational) — but sparingly, never stacked. **Provide help, not just limits**: "Remove filter to take burst shots" beats "Can't take burst shots while filter applied." Never blame the user or single them out for a restriction — "This file can't be deleted," not "You can't delete this file." Leave some **intrigue**: don't cram every technical detail into menu subtext; let users discover functions by exploring rather than front-loading every explanation.

## Accessibility

> Source pages: `accessibility/screen-reader.html`, `focus-order.html`, `color-contrast.html`, `layout-and-typo.html`, `interaction-and-control.html`, `content.html`.

- **Screen reader**: every focusable element can carry up to four audible components, read in fixed order — **status value** (mandatory if present, e.g. On/Off, Selected/Not selected) → **name** (mandatory — visible text or defined alt text) → **element type** (auto, from interaction type) → **usage hint** (optional, e.g. "Double tap to activate"). Alt text must stand alone without visual references ("New content available," not "New"), skip decorative/non-focused images, and describe emoji/GIFs/stickers plainly.
- **Focus order**: must flow logically (wrap to next/previous line at row edges, no infinite looping at row ends); skip decorative elements and empty space entirely; group tightly-related elements into one focus stop rather than forcing users through each individually.
- **Color and contrast**: never encode meaning in color alone — pair with an icon/shape/text marker too (test by switching the UI to grayscale). Minimum contrast: **{typography.contrast-small-text-min}** small text, **{typography.contrast-large-text-min}** large text ({typography.large-text-threshold}).
- **Layout and typography**: all text except subtitles/text-in-images must resize up to **200%** without breaking layout/function; icon-only buttons need a **label toast** (tooltip) on long-press; touch targets need enough size *and* spacing to avoid accidental hits, especially for users with limited mobility.
- **Interaction and control**: nothing should auto-hide before the user has had time to act on it; no autoplay beyond 5 seconds without visible pause/next/previous controls (this matters even more with a screen reader running); provide non-gesture alternatives to drag-and-drop/multi-finger input; label input fields so autofill can work; give clear errors with the fix path, focus landing on the next actionable element; keep control placement **consistent** across the app so it stays learnable.
- **Content**: instructions must be describable without referencing shape/color/position ("Tap Start," never "tap the square button below"); pair any audio cue with a visible equivalent; give users control over which notification channels fire; provide captions/scripts/alt text for multimedia; warn before strobing or rapid-brightness effects, or avoid them entirely.

## Large screen & Foldable

> Source pages: `largescreen-and-foldable/intro.html`, `large_screen_layout.html`, `designing_for_foldable.html`.

### Window size classes (published breakpoints, dp width)
| Class | Width | Panes | Navigation |
|---|---|---|---|
| Compact | < 600dp | 1 | Navigation bar, modal navigation drawer |
| Medium | 600–840dp | 1 (recommended) or 2 | Navigation rail, modal navigation drawer |
| Expanded | ≥ 840dp | 1 or 2 (recommended) | Navigation rail, modal or standard navigation drawer |

### Multi-pane ratios
| Breakpoint (dp) | 1st pane | 2nd pane |
|---|---|---|
| 600 ≤ width < 960 | 42% | 58% |
| width ≥ 960 | 38% | 62% |
| Foldable (Z Fold, either breakpoint) | 50% | 50% |

- Stretched-out single-pane layouts on a wide screen are called out as a failure mode ("harder to read, wastes the extra space") — the fix is always a second (or third) pane, not a wider single column.
- Small, self-contained inputs use a **pop-over near the triggering element**, not a full-screen takeover — reduces finger travel and keeps context.
- **Foldables** (Z Fold/Flip) carry a cover screen (closed) and main screen (open); transitions between them must be seamless — the app reopens exactly where the user left off (same scroll position, same in-progress text input, same keyboard state).
- **Flex mode** (partially folded, resting on a table): content moves to the top (angled screen half), controls move to the bottom (flat screen half); the app must adapt automatically as fold angle changes.
- Baseline checklist for any large-screen/foldable-aware screen: resizable, landscape-supported, correct on both cover and main screens, no letterboxing, fills the screen edge-to-edge.

## Do's and Don'ts

### Do
- Let one system blue (`{colors.primary-dark-light}` / `{colors.primary-dark-dark}`) carry almost all the color signal; keep backgrounds calm and monotone.
- Split every screen into a passive viewing area (top) and an actionable interaction area (bottom).
- Use blur+dim *or* shadow for screen-to-screen depth — pick one, never stack them.
- Cap components hard: ≤3 app-bar actions, ≤5 bottom-bar actions, ≤5 (ideally 4) bottom-nav tabs, ≤31-char list labels, ≤3-line toasts.
- Write one choice per screen; explain trade-offs instead of just imposing limits; use singular "they."
- Hit 4.5:1 / 3:1 contrast minimums and never encode meaning in color alone.
- On wide screens, add a second/third pane instead of stretching one column; use the published breakpoint ratio table.

### Don't
- Don't reach for a decorative gradient as the default background — it's the rare exception, not the rule.
- Don't combine shadow and dim on the same transition — the docs call this out explicitly as a fatigue risk.
- Don't use more than one button style (flat vs. contained) on a single screen.
- Don't show a lone action button in a bottom bar, or make bottom-nav tabs swipeable.
- Don't write defensive warning text for non-issues, or stack more than one confirmation popup in a row.
- Don't stretch a single-column layout across a tablet/foldable-width screen instead of using a multi-pane layout.

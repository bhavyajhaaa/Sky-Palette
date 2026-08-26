# Sky Palette — Design Direction

## What this is

Sky Palette is an authored, playful digital object built from sky photographs.

A sky can be experienced in three related ways:

- as a photograph in the Archive
- as extracted colors in Palette
- as a continuous interactive surface in Fluid

The site should feel like something to explore and play with, not like a conventional product or dashboard.

## Core principle

**Let the artwork carry the interface. Remove structure before adding decoration.**

The site should remain visually quiet around the content. Controls appear because they have a clear job, not because a website convention says they should exist.

## Global visual rules

### Do

- Let Fluid, Palette, and Archive dominate the viewport.
- Use whitespace as structure.
- Use one characterful but readable typeface throughout.
- Favor a soft, lumpy, hand-shaped sans rather than a generic geometric product font.
- Keep persistent text minimal.
- Use custom hand-drawn SVG marks for primary navigation and hand interaction.
- Keep surfaces square or nearly square when containment is functionally necessary.
- Reveal secondary information on hover/focus when that does not harm accessibility.
- Use simple contrast changes before adding animation.
- Keep light/dark theme transitions subtle and limited to UI chrome.

### Do not

- Add a conventional navbar.
- Show the site name in the page UI.
- Add page headings or explanatory subtitles where the content is self-explanatory.
- Use pill buttons, glassmorphism, decorative blobs, generic SaaS cards, or gradients in UI chrome.
- Add animation merely to make controls feel polished.
- Use generic icon-library marks for the three primary views.
- Add a second font without a clear need.
- Make the interface deliberately strange at the cost of legibility or discoverability.

## Site identity

The name **Sky Palette** belongs in:

- the browser tab
- favicon/metadata
- Open Graph/social sharing metadata

It does not need to be written visibly on the site.

Description:

> To play with the skies I've seen

## Primary navigation

There are three views:

1. Fluid
2. Palette
3. Archive

Navigation is a group of **three small floating custom SVG marks at the top center**.

Each mark should be hand-drawn in the same visual language.

Possible visual ideas:

- Fluid: an irregular flowing line
- Palette: a loose cluster/grid of imperfect cells
- Archive: two offset picture-like rectangles

Rules:

- No permanent text labels.
- Show `Fluid`, `Palette`, and `Archive` on hover/focus.
- Add accessible text labels/ARIA labels.
- Active view uses a simple contrast change only for V1.
- Do not add a pill, underline, container, animated blob, or active background unless later testing gives a reason.

## Add a sky

`+ Add a sky` floats independently at the top right.

It remains textual because it is a meaningful action, not a frequent navigation control.

Rules:

- quiet typography
- no pill treatment
- no heavy primary-CTA styling
- preserve the existing paste → review colors → submit interaction

## Fluid

Fluid is the default homepage and the most expressive view.

The artwork should occupy the viewport without a conventional header or page title.

### Pointer interaction

The normal computer pointer continues to stir Fluid through the existing interaction.

### Hand interaction

Fluid also supports optional webcam-based hand interaction.

The established gesture is:

- open fingers / no pinch: no Fluid input
- pinch thumb + index finger: touch the Fluid
- move while pinched: stir/push the Fluid
- release: stop adding input while the Fluid's existing momentum continues

While a pinch is actively engaged:

- hand input temporarily overrides mouse-to-Fluid movement
- the mouse still operates all normal site controls

Hand tracking must never synthesize browser pointer events or control the rest of the site.

### Hand control icon

A custom hand-drawn **pinched-hand SVG** appears immediately to the left of the Fluid navigation mark when Fluid is active.

States:

- Fluid active, camera off: visible but subdued
- Fluid active, camera on: stronger / active
- Fluid not active: hand icon is not shown

Do not show a disabled hand control on Palette or Archive.

### First camera activation in a session

On the first activation of hand control during a browser session:

- show the debug-style webcam preview with hand tracking
- show a centered instruction for about 5 seconds

Primary instruction:

> Swirl these waters by pinching your hand and dragging.

Privacy subtitle should communicate, plainly, that computer-vision processing happens locally and camera data is not uploaded.

A suitable starting sentence:

> Your camera is processed on this device and isn't uploaded.

After about 5 seconds:

- instructional text disappears
- webcam preview disappears from the normal artwork experience
- hand interaction continues

Show this instructional state once per session, not on every camera toggle.

### Hand contact feedback

Do not use a permanent hand cursor.

While the pinch is actively touching Fluid, show a **tiny transient contact point** at the interaction location.

It should be subtle and disappear when the pinch releases.

The Fluid response itself should remain the primary feedback.

### Camera debug view

Fluid Settings should include a control to show/hide the webcam + hand-tracking debug view.

This is useful for understanding tracking without making the webcam feed part of the normal artwork.

## Fluid utilities

Bottom-right contains only Fluid-specific utilities:

- Reset — icon
- Settings — slider/tuning icon

Use custom/simple marks consistent with the rest of the site.

Do not use text labels persistently; provide hover/focus tooltips and accessible labels.

The hand control does **not** live here; it belongs beside the Fluid navigation mark.

## Settings

Settings is an intentional exception to the low-text rule.

Clarity matters more than abstraction inside Settings.

It may contain:

- existing Fluid parameters/presets
- light/dark theme control
- show/hide camera tracking debug view

Settings should remain visually quiet and readable.

Theme belongs here rather than in the persistent global UI.

## Palette

Palette is the discrete color view.

Rules:

- no page title
- no explanatory subtitle
- colors fill the visual field
- hover/focus reveals HEX only
- do not add image provenance to Palette for V1
- visitor-hidden skies do not contribute colors

## Archive

Archive is the photographic source collection.

Rules:

- no `Archive`, `Collection`, or explanatory heading
- preserve generous spacing and the small-artworks-on-a-wall feeling
- photographs remain visually unchanged when included/hidden from Palette/Fluid
- no selection overlay, image dimming, or checkmark over the image

### Visitor inclusion control

Visitors can choose which skies contribute to Palette and Fluid.

This selection:

- is local to that browser
- does not write to Supabase
- does not affect other visitors
- persists using the existing visitor-local state

Interaction:

- the whole photograph is an easy toggle target
- clicking/tapping toggles whether that sky contributes to Palette/Fluid
- detail navigation remains a separate interaction

State indicator:

- use a small **circular checkbox** in the metadata row beneath the image
- checked circle = included in Palette/Fluid
- unchecked circle = hidden from Palette/Fluid
- keep it thin-stroked, quiet, and always visible

Metadata row:

- description/date appear on hover/focus as currently intended
- circular checkbox remains visible at all times
- keep the row height/layout stable so nothing jumps

Hidden images remain fully visible in Archive.

`Show all` may remain as a subtle archive-level action.

## Delete

Delete is separate from visitor hiding.

Delete:

- permanently removes the sky
- remains password-protected
- removes database record and stored image
- is an admin/destructive action, not part of the normal Archive selection interaction

## Bottom attribution

Bottom-left:

> Made to play. Work is at jhabhavya.com

Only `jhabhavya.com` is the link.

Keep it visually secondary and persistent across the three views.

Fluid-specific utilities occupy the bottom-right independently.

## Light and dark themes

Theme is controlled from Settings.

Theme changes should:

- ease UI background, text, border, and control colors
- remain quick and subtle
- not animate Fluid, Palette colors, or photographs
- not use masks, reveals, wipes, or fluid simulations

## Accessibility

Minimal UI must not mean inaccessible UI.

- Icon-only controls require meaningful accessible labels.
- Hover labels should also appear on keyboard focus.
- Maintain visible focus treatment.
- Small visible marks may have larger invisible hit areas.
- Archive inclusion state must be exposed semantically, e.g. `aria-checked`/`aria-pressed` as appropriate.
- Webcam interaction is optional; pointer interaction remains available.
- Reduced-motion preferences remain respected.

## Implementation philosophy

These design rules do not imply implementing every redesign change in one task.

Work in small, reversible iterations:

**decide → prototype → inspect → keep/reject → document/refactor**

For each change:

- test one meaningful uncertainty
- preserve working Fluid behavior
- avoid speculative architecture
- use the simplest mechanism that produces the intended result
- remove abandoned experiments rather than layering new patches over them

`design.md` records stable design decisions. Individual Codex prompts should still contain only the context relevant to that task.

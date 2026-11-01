---
version: alpha
name: SecondNurse Clinical Field Record
description: Warm editorial paper meets Carbon-grade instrument precision for a home sterile-technique trainer.
colors:
  primary: "#0C6B57"
  secondary: "#4C463C"
  tertiary: "#B7332E"
  neutral: "#FAF7F1"
  ink: "#1B1813"
  muted: "#6E6455"
  card: "#FFFDF8"
  sand: "#F3EEE3"
  cap-blue: "#2F6FED"
  cap-blue-text: "#2459C4"
  amber: "#8A5E10"
typography:
  display:
    fontFamily: Fraunces
    fontSize: 4.4rem
    fontWeight: 500
    lineHeight: 0.99
    letterSpacing: "-0.015em"
  section:
    fontFamily: Fraunces
    fontSize: 3rem
    fontWeight: 500
    lineHeight: 1.05
  body:
    fontFamily: "Instrument Sans"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
  body-small:
    fontFamily: "Instrument Sans"
    fontSize: 0.88rem
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.16px"
  caption:
    fontFamily: "IBM Plex Mono"
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: "0.32px"
rounded:
  sm: 8px
  md: 12px
  lg: 16px
  xl: 22px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "#FBF8F1"
    rounded: "{rounded.pill}"
    padding: 12px 20px
    height: 48px
  button-primary-hover:
    backgroundColor: "#000000"
    textColor: "#FBF8F1"
    rounded: "{rounded.pill}"
    padding: 12px 20px
    height: 48px
  button-danger:
    backgroundColor: "{colors.tertiary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    padding: 12px 20px
    height: 48px
  panel:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: 18px
  panel-sand:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.lg}"
    padding: 24px
  caption-label:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.muted}"
    rounded: "{rounded.sm}"
    padding: 4px 8px
  chip-object:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.cap-blue-text}"
    rounded: "{rounded.pill}"
    padding: 4px 8px
  mask-cap:
    backgroundColor: "{colors.cap-blue}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: 0px
  chip-time:
    backgroundColor: "#F7EDD4"
    textColor: "{colors.amber}"
    rounded: "{rounded.pill}"
    padding: 4px 8px
---

## Overview

Clinical Field Record: warm parchment paper (Claude-style editorial warmth), a single-weight serif voice for authority, and Carbon-grade discipline underneath — 8px spacing grid, token-driven components, 48px interactive heights, depth from surface layering before shadows. The product is an instrument, not a dashboard: every colour is functional (hand amber, sterile tip red, cap blue, field teal) and every annotation reads like a bench record.

## Colors

- **Primary (#0C6B57):** Clinical teal. Sterile-field boundary, primary actions, success. 6.03:1 on paper.
- **Tertiary (#B7332E):** Breach red. Reserved for alerts and the sterile tip; white text on it measures 5.96:1.
- **Muted (#6E6455):** The smallest text colour allowed on paper. 5.43:1 — chosen by measurement, not eye.
- **Amber (#8A5E10):** Hand mask and time chips. Darkened from #B7791F (3.40:1, failed AA) to pass at 5.32:1.
- **Neutral (#FAF7F1):** Parchment canvas. Never pure white as a page background.

## Typography

Fraunces at weight 500 only for display and section headings — one serif voice, book-title presence. Instrument Sans for UI and body at 1.6 line height for editorial reading. IBM Plex Mono for technical annotation, with Carbon micro-tracking: 0.16px at 14px, 0.32px at 12px captions. No letter-spacing on display text.

## Layout

Strict 8px base grid (4px micro-adjustments only). Page container 1560px for the hero instrument, 1240px for reading sections. Sections alternate parchment and warm sand bands for chapter-like rhythm. Reading line length capped near 46em. All interactive targets at least 44px, primary buttons 48px.

## Elevation & Depth

Depth comes first from surface layering (paper → sand → card), then from the system's signature hard offset shadow (ink at 90%, 12px on the instrument, 6–8px on cards) — a printed-record shadow, never a soft SaaS glow. Whisper borders (1px warm line) contain; hard shadows elevate only what the user operates.

## Shapes

Pill buttons (999px) against 22px instrument corners and 12–16px cards. The pill/rectangle tension is deliberate: pills are for hands (actions), rectangles are for records (content).

## Components

`button-primary` is the only high-emphasis action per view. `button-danger` exists solely for breach scenarios and alerts. Panels are records: card surface, whisper border, hard shadow. Chips encode rule types — object (neutral), forbidden contact (red), minimum time (amber) — and never decorate.

## Do's and Don'ts

- Do keep every neutral warm-toned; no blue-grays anywhere except the cap's functional blue.
- Do measure any new text colour against its background; AA (4.5:1) is the floor for text at any size.
- Do keep serif weight at 500. Do not bold Fraunces.
- Don't introduce a second accent hue, gradients, or glass effects.
- Don't shrink touch targets below 44px or primary buttons below 48px.
- Don't set small text in Muted lighter than #6E6455 on paper.

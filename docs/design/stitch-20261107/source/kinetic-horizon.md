---
name: Kinetic Horizon
colors:
  surface: '#fcf8ff'
  surface-dim: '#dcd8e5'
  surface-bright: '#fcf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f2ff'
  surface-container: '#f0ecf9'
  surface-container-high: '#eae6f4'
  surface-container-highest: '#e4e1ee'
  on-surface: '#1b1b24'
  on-surface-variant: '#464555'
  inverse-surface: '#302f39'
  inverse-on-surface: '#f3effc'
  outline: '#777587'
  outline-variant: '#c7c4d8'
  surface-tint: '#4d44e3'
  primary: '#3525cd'
  on-primary: '#ffffff'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#c3c0ff'
  secondary: '#b22200'
  on-secondary: '#ffffff'
  secondary-container: '#d73b19'
  on-secondary-container: '#fffbff'
  tertiary: '#7e3000'
  on-tertiary: '#ffffff'
  tertiary-container: '#a44100'
  on-tertiary-container: '#ffd2be'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#ffdad3'
  secondary-fixed-dim: '#ffb4a4'
  on-secondary-fixed: '#3d0600'
  on-secondary-fixed-variant: '#8c1800'
  tertiary-fixed: '#ffdbcc'
  tertiary-fixed-dim: '#ffb695'
  on-tertiary-fixed: '#351000'
  on-tertiary-fixed-variant: '#7b2f00'
  background: '#fcf8ff'
  on-background: '#1b1b24'
  surface-variant: '#e4e1ee'
typography:
  display-hero:
    fontFamily: Plus Jakarta Sans
    fontSize: 44px
    fontWeight: '800'
    lineHeight: 52px
  display-hero-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 38px
  headline-metric:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 40px
  headline-metric-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 30px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
  label-stat:
    fontFamily: Plus Jakarta Sans
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.75rem
  margin: 1.5rem
  margin-mobile: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system channels the athletic energy of next-generation mobility, running, and physical wellness tracking. It fuses the crisp clarity of modern iOS sport interfaces with hyper-focused metric visualization. The interface speaks to active individuals, urban runners, and health-conscious commuters who require instant legibility during movement alongside rewarding data insights at rest.

The design movement combines **Modern High-Contrast Sport Minimalist** with **Neo-Tactile Metric Surfaces**:
- **Clean Kinetic Canvas**: Airy, ultra-light cool tinted backgrounds keep eye fatigue low while running outdoors or in direct sunlight.
- **Electric Dual-Tone Contrast**: Deep electric indigo-violet acts as the structural anchor, contrasted immediately against vivid coral-sunset accents that signal heat, heart rate, active states, and record milestones.
- **Heroic Data Architecture**: Large monoline or condensed numerical figures ensure zero cognitive friction at a glance.
- **Dark Inverted Focus Zones**: Mission-critical runtime controls (e.g., active timer docks, live metrics, route recording overlays) leverage rich obsidian/slate navy surfaces to isolate inputs from ambient map or dashboard noise.

## Colors

The palette employs energetic chromatic tension balanced against an uncluttered, high-key backdrop.

### Roles & Semantic Applications
- **Primary (`#4F46E5` / Royal Electric Indigo)**: Primary brand actions, active track lines, selection pills, gradient base stops, and primary analytical bars.
- **Secondary (`#FF5733` / Sunset Flare Coral)**: Highlights peak performance values (e.g., top pace, elevated heart rate zone, current record bar), live recording beacons, play/pause action accents, and critical milestones.
- **Tertiary (`#A2A4C9` / Slate Periwinkle)**: Applied to secondary cards, subtle component containers, and supporting thematic elements.
- **Neutral Light Base (`#F4F5FB` to `#FFFFFF`)**: The canvas employs a subtle cool-indigo tint (`#F4F5FB`) that separates floating white cards (`#FFFFFF`) naturally without artificial heavy borders.

### Surface Color Mapping
- `surface-canvas`: `#F4F5FB`
- `surface-card`: `#FFFFFF`
- `surface-dark-card`: `#1A1B2F`
- `surface-metric-pill`: `#EEF0FF`
- `text-primary`: `#111222`
- `text-secondary`: `#6B708A`
- `text-inverted`: `#FFFFFF`
- `accent-coral-glow`: `rgba(255, 87, 51, 0.15)`

## Typography

The design system uses **Plus Jakarta Sans** uniformly to merge athletic geometry with modern humanist legibility. Its open counters and geometric curve apexes retain clarity on small screen viewports and high-vibration scenarios (e.g. running or cycling).

### Hierarchical Logic
- **Display & Large Metrics (`headline-metric`, `display-hero`)**: Rendered in weight 700 and 800 with tight vertical tracking. Numeric values sit front and center to ensure immediate comprehension.
- **Section Headers (`headline-lg`, `headline-md`)**: Crisp sentence case. Headers stay tight to their relevant card containers to preserve spatial association.
- **Micro Labels (`label-md`, `label-stat`)**: Used for metric suffixes (e.g., `Bpm`, `Calories`, `Steps`, `km/h`), breadcrumbs, and axis tabs. Set with higher weights (600–700) and generous line heights to ensure instant legibility next to high-magnitude digits.

## Layout & Spacing

The layout is built upon an 8-point baseline rhythm designed around fluid viewport adaptation and tight, mobile-first card modularity.

### Layout Philosophy & Adaptability
- **Mobile Handheld (320px – 480px)**: Single-column stack with `margin-mobile: 1.25rem`. Vertical flow organizes hero content (3D visual or route map) into top viewports, followed by a 3-part stat distribution row, anchored with a persistent bottom floating console.
- **Tablet (481px – 1024px)**: 6-column grid with `gutter: 1rem`. Map visualizations and analytical bar graphs share horizontal split cards.
- **Desktop / Large Dashboard (1025px+)**: 12-column grid capped at a max-content width of `1280px` with central alignment. Metrics nest alongside expandable telemetry timelines.

### Spatial Rhythms
- **Icon-to-Label Internal Gap**: `space-xs` (4px).
- **Stat Label-to-Value Gap**: `space-sm` (8px).
- **Metric Card Internal Padding**: `space-md` (16px) or `space-lg` (24px) on hero banners.
- **Inter-Card Vertical Separation**: `space-md` (16px).

## Elevation & Depth

Visual depth is achieved through **Tonal Layering** and **Soft Luminescent Ambient Shadows**, deliberately eschewing heavy border strokes.

### Elevation Hierarchy
1. **Canvas Level (Elevation 0)**: `#F4F5FB` flat ground.
2. **Standard Metric Cards (Elevation 1)**: Pure white `#FFFFFF` cards elevated with an ultra-soft dual shadow:
   - Primary: `0 4px 20px -2px rgba(26, 27, 47, 0.04)`
   - Diffuse: `0 12px 32px -4px rgba(79, 70, 229, 0.06)`
   This produces a gentle lift tinted with the primary indigo rather than a generic murky black.
3. **Floating Controls & Top App Bars (Elevation 2)**: White or circular micro-action buttons with `0 8px 24px -2px rgba(26, 27, 47, 0.08)`.
4. **Hero Dark HUD & Runtime Bars (Elevation 3)**: Obsidian navy cards (`#1A1B2F`) floating above map terrains. Uses deep ambient drops: `0 16px 40px -6px rgba(17, 18, 34, 0.28)`.
5. **Interactive Highlight Pills**: Glowing buttons or chart highlights utilize saturated back-reflections, e.g., coral badges cast `0 6px 16px 0 rgba(255, 87, 51, 0.35)`.

## Shapes

The interface embraces a **pill-shaped, high-radius form language (`roundedness: 3`)**. Smooth continuous curves reflect human movement, biomechanics, and contemporary ergonomic gear.

### Corner Radius Mapping
- **Buttons, Floating Action Pills, and Route Status Badges**: Full pill radius (`9999px` / `rounded-full`).
- **Main Metric Surfaces, Analytics Cards, and Bottom Consoles**: Smooth rounded corners using `2rem` (`32px` on mobile screens).
- **Stat Micro-Wells & Icon Pods**: Medium rounded pill profile (`1rem` / `16px`).
- **Data Chart Columns**: Vertical track bars finish with rounded top and bottom caps (`9999px`) to maintain fluid geometry across bar charts.

## Components

### Buttons & Action Triggers
- **Primary CTA Button**: Full pill profile (`rounded-full`), `#4F46E5` background, high-contrast white text, `label-lg` typography. Padding: `16px 28px`.
- **Secondary / Emergency Action (Pause/Stop)**: Sunset Coral (`#FF5733`) circular icon button or pill button with high-contrast white icon glyphs.
- **Circular Utility Icon Buttons**: 44px × 44px white circle with dark slate icon (`#1A1B2F`) and soft elevation shadow, providing clean tap targets for back navigation, share, and grid toggles.

### Metric Badges & Chips
- **Time/Pace Indicator Chips**: Ultra-rounded pill (`9999px`) featuring a deep navy `#1A1B2F` or soft lilac `#EEF0FF` background. White or `#4F46E5` text respectively.
- **Vertical Tab Axis (Time Filter)**: Left-aligned minimalist vertical strip (`Today`, `Weekly`, `Monthly`, `Yearly`) in `label-stat` weight, transitioning from muted `#A5A9C4` to active `#FFFFFF` or `#4F46E5`.

### Cards & Telemetry Containers
- **Clean White Metric Card**: Base `#FFFFFF` with `rounded-xl` (32px), internal padding of `20px`. Holds stat clusters (Calories, Heart Rate, Steps) with centered vertical alignments.
- **Dark HUD Console Card**: Solid `#1A1B2F` card, floating over the bottom edge of viewports. Houses the primary timer (`02:24:15`), distance counters, and active action pills.
- **Analytical Gradient Card**: Indigo-to-violet linear gradient surface (`linear-gradient(180deg, #4F46E5 0%, #3B3B98 100%)`) holding contrast bar graphs and floating tooltip badges (`16 km/h`).

### Form Controls & Switches
- **Toggle Switches**: Pill shape track (`52px × 32px`). Off-state in cool gray `#E2E4F0`; active state in vibrant `#4F46E5`. Circular thumb floats with crisp drop shadow.
- **Inputs**: Seamless single-surface fields with `#FFFFFF` or `#EEF0FF` fill, zero border, and clear slate placeholder labels.

### Charts & Data Visualizations
- **Dynamic Bar Graphs**: Rounded capsules with light indigo inactive bars (`#7A7FE8`) and a highlighted peak bar rendered in vibrant Sunset Coral (`#FF5733`).
- **Map Trajectory Lines**: Continuous `#FF5733` path with distinct circular waypoint nodes (`#1A1B2F` halo with white core).
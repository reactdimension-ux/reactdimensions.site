# React Bits - UI and layout research

Scope: UI and component layout only. Source of truth is the open-source repo
(github.com/DavidHDev/react-bits, `main`, read via raw.githubusercontent.com and GitHub tree pages).

**Important limitation:** `https://reactbits.dev` could not be fetched (the sandbox cannot resolve the host).
Nothing below was seen on the live site. Everything comes from repo files, and the visual result
(exact pixel layout, motion feel) is inferred from code and CSS. Items marked "Not verified" are gaps.

---

## 1. Tech stack

| Area | Finding | Version (package.json) | Source |
|---|---|---|---|
| Framework | React (SPA, client rendered) | react / react-dom ^19.0.0 | package.json |
| Bundler | Vite with `@vitejs/plugin-react`; 3 HTML entries (`index`, `studio-frame`, `shape-frame`) | vite ^5.3.4 | package.json, vite.config.js |
| Router | `react-router-dom` BrowserRouter, pages lazy-loaded, prefetch on intent | ^6.30.1 | src/App.jsx |
| URL state | `nuqs` with React Router adapter | ^2.8.6 | App.jsx |
| UI kit | Chakra UI v3 + Emotion, scoped by a `ChakraScope` wrapper (landing page is rendered without it) | @chakra-ui/react ^3.20.0 | App.jsx, package.json |
| Styling | Hand-written CSS files in `src/css/` driven by CSS variables, plus Chakra props; Tailwind v4 only used for the *Tailwind variants of library components* | tailwindcss ^4.0.3, @tailwindcss/vite | src/css, vite.config.js |
| Animation | gsap (+ @gsap/react), motion, lenis (smooth scroll) | gsap ^3.13, motion ^12.23, lenis ^1.3 | package.json |
| 3D / WebGL | three, @react-three/fiber, drei, postprocessing, rapier, ogl, matter-js | three ^0.180, r3f ^9.3 | package.json |
| Theme | `next-themes` present; boot script sets `data-theme` from localStorage key `react-bits-theme` (default dark) | ^0.4.6 | index.html |
| Fonts | Geist (sans + mono, variable, `geist` package); Google Fonts: Bricolage Grotesque, Gochi Hand, Press Start 2P, Google Sans Code | geist ^1.7.0 | index.html, styles.css |
| Icons | hugeicons, lucide-react, react-icons | - | package.json |
| Code highlight | `shiki` | ^4.4.3 | package.json, components/code/ShikiCode.jsx |
| Toasts | sonner | ^1.7.1 | package.json |
| Registry tooling | `jsrepo` + `@jsrepo/shadcn` generate shadcn-compatible JSON into `public/r` | jsrepo ^3.2.0 | jsrepo.config.ts |
| Hosting hint | `wrangler.jsonc` + `worker/` folder (Cloudflare) | - | repo root tree |
| Build extras | scripts for sitemap, RSS, OG images, llms.txt, SEO checks, prop-doc checks | - | package.json scripts |

Notes
- No Storybook / MDX / Docusaurus-style doc tool was seen. Docs pages are plain JSX "demo" files (see section 4).
- Licence: MIT + Commons Clause (c) 2026 David Haz. Components may be used commercially but not resold or redistributed as a bundle or port (LICENSE.md).

---

## 2. Overall page structure

Evidence: `components/layout/SidebarLayout.jsx`, `components/navs/Header.jsx`, `Sidebar.jsx`, `styles.css`.

```
+--------------------------------------------------------------------------+
| HEADER  (class main-nav, z-index 100, height var --docs-header-height 60px)
| [logo]  [Tools (New)]        [Search... /]  [prefs] [Star on GitHub]     |
+----------------+-----------------------------------------+---------------+
| SIDEBAR        | MAIN CONTENT (children)                 | RIGHT PANEL   |
| fixed, 256px   | docs overview header + component page   | ProCard       |
| left 16px      | content column max 1080px               | SponsorsCard  |
| rounded 16px   |                                         |               |
| blurred glass  | ... Related, pager, tabs footer ...     |               |
+----------------+-----------------------------------------+---------------+
                                                   [back-to-top button, fixed bottom-right]
```

- Wrapper: `<main class="app-container">` > Navbar + `<section class="category-wrapper">` containing Sidebar, children, `<aside class="right-panel">` (SidebarLayout.jsx).
- Sidebar is `position: fixed`, top = header height + 16px, left 16px, height = 100vh - header - 32px, width 256px (Sidebar.jsx).
- Header fixed/sticky: Header.jsx only sets `zIndex={100}`; positioning is in CSS not read. Not verified.
- Footer: SidebarLayout renders none; a `TabsFooter` and `ComponentPager` sit under each component page.
- Landing page (`/`) is a separate bare route without the docs layout (App.jsx, `landingnew/` components).
- Page transitions: content wrapper fades (`page-transition-fade`) and scrolls to top on route change (CategoryPage.jsx); lazy chunks use `SkeletonLoader` as fallback.
- Boot loader: inline pulsing SVG logo in index.html hides the app until ready (10 s fallback).

Mobile (from code)
- Sidebar width is `0` below Chakra `md`; replaced by a full-width drawer (100vw, top offset 50px).
- Header hides desktop controls below `md`; an "Open Menu" button opens a top drawer (Tools, Useful links, Other).
- `ProCardMobile` is rendered below the layout in place of the right panel card.
- CSS breakpoints seen: 967px (container padding 2em -> 1em) and 1000px (back-to-top position). Whether `.right-panel` collapses is not verified.

---

## 3. The sidebar

Source: `components/navs/Sidebar.jsx`, `constants/Categories.js`, `css/sidebar.css`.

```
+------------------------+
| Browse all components  |  <- becomes "Viewing all components" (dimmed) on index
| [All][Txt][Cmp][Mic][Anim][Bg]  <- icon picker, sliding pill + tooltip
| [ Filter 215 components... ]    <- search input
| Get Started            |
|   Introduction ...     |
| Text Animations        |
|   Split Text   [New]   |
|   Blur Text    [Updated]
| ...                    |
| Explore Pro            |
+------------------------+
```

- Data: `CATEGORIES` array of `{ name, subcategories[] }`. Categories: Get Started (Introduction, Installation, MCP, Changelog), Text Animations, Animations, Components, Micro, Backgrounds.
- README counts: Text Animations 33, Animations 38, Components 48, Micro 34, Backgrounds 63 (215+ total).
- Search: local filter, case-insensitive; a category-name match keeps all its items; otherwise only matching items. Placeholder "Filter N components..."; empty state "No matching pages". A separate global `SearchDialog` (header "Search..." with `/` hint) also exists.
- Picker: choosing a category narrows the list and navigates to `/c/:slug`.
- Badges: `NEW` and `UPDATED` constants decide `<span class="new-tag">` / `updated-tag`. Tag style: 9px text, 4px radius, translucent purple (dark) / pale purple with border (light).
- Active item: class `active-sidebar-item`, colour `#cf9dff` (dark) / `#7b2cbf` (light), weight 500; active item is scrolled into view smoothly.
- Scroll edges: fade overlays toggled via `is-at-top` / `is-at-bottom` classes.
- Hover preview: floating card 304x226 showing media for a hovered item (motion blur/scale, off if reduced motion).
- Styling: glass panel (`color-mix` of panel colour 78%, `backdrop-filter: blur(18px)`), 1px border, 16px radius.
- Not verified: how many items are currently flagged New.

---

## 4. A component documentation page

Sources: `pages/CategoryPage.jsx`, `components/common/TabsLayout.jsx`, `demo/TextAnimations/SplitTextDemo.jsx`, `components/code/*`.

```
+-----------------------------------------------------------+
| DocsOverview (title + description + SEO data)             |
+-----------------------------------------------------------+
| TOOLBAR  [Preview | Code]      [width presets][fav][share][Copy for AI][...] |
+-----------------------------------------------------------+
| PREVIEW TAB                                               |
|  +-----------------------------------------------------+  |
|  | demo-container: live stage  [refresh button]        |  |
|  | (resizable: Desktop / Tablet 768 / Mobile 375)      |  |
|  +-----------------------------------------------------+  |
|  Customize  (selects, colour pickers, sliders, switches)  |
|  PropTable  (name, type, default, description)            |
|  Dependencies  (e.g. gsap, @gsap/react)                   |
+-----------------------------------------------------------+
| CODE TAB                                                  |
|  Install   [CLI|Manual] [pkg manager + shadcn/jsrepo] [copy]
|  Usage     (reflects current Customize settings)          |
|  Component code  with variant switch: JS/TS x CSS/Tailwind|
|  CSS section (CSS variants) + any extra files             |
+-----------------------------------------------------------+
| RelatedComponents   ComponentPager (prev/next)   TabsFooter|
+-----------------------------------------------------------+
```

Order, as read
1. `CategoryPage` renders `DocsOverview` (title/description from SEO data) then the lazy component page, then `BackToTopButton`.
2. `TabsLayout` (Chakra `Tabs`, `variant="plain"`, `lazyMount`) has exactly two tabs: Preview and Code. No separate Docs tab.
3. Toolbar `docs-toolbar`: sliding-pill segmented switch, then width presets / fullscreen, favourite, copy-share-link, `CopyForAIMenu`, overflow "More actions" menu. Backgrounds category also gets demo-mode controls in a `preview-controls` slot over the frame.
4. Preview tab: `PreviewStage` + `PreviewResizer` (drag to resize), `demo-container` with a refresh button that re-keys the component to replay animation.
5. Controls sit **below** the stage in a `Customize` block, not beside it: `PreviewSelect`, `PreviewColorPickerCustom`, `PreviewSlider`, `PreviewSwitch`. State comes from `useComponentProps(DEFAULT_PROPS)` and a context provider; presets (e.g. Rise, Flip, Blur, Wave for SplitText) set many props at once.
6. Then `PropTable` (SplitText documents about 22 props) and `Dependencies`.
7. Code tab (`CodeExample.jsx`): `CliInstallation` first (dependencies feed into it), then Usage (marked "With your settings" if changed), then main code inside `CodeOptions` with four variants (Tailwind, CSS, TS Tailwind, TS CSS), then any extra files as their own `CodeSection`s.
8. Language/style choice (JS/TS, CSS/TW) is a global preference in the header "Preferences" menu, not per page.
9. Section wrapper `CodeSection`: `<section class="code-section-frame">` with header (h2 title, optional note, actions) and body.
10. Highlighting through `ShikiCode.jsx`.

Not verified: exact spacing and border of the stage frame (the `.demo-container` / `.preview-panel` rules were not in docs.css; they live in another CSS file I did not read).

---

## 5. Code organisation in the repo

Root: `.github/ public/ scripts/ src/ worker/ index.html shape-frame.html studio-frame.html jsrepo.config.ts wrangler.jsonc vite.config.js CONTRIBUTING.md`.

```
src/
  App.jsx, main.jsx, styles.css
  pages/        CategoryPage, CategoryIndexPage, LandingPage, ToolsPage, ProPage, ShowcasePage, ...
  routes/       route wrappers (contents not read)
  components/
    navs/       Header.jsx, Sidebar.jsx
    layout/     SidebarLayout.jsx, Providers.jsx
    common/     TabsLayout, SearchDialog, ComponentPager, CopyForAIMenu, DocsOverview, ...
    code/       CodeExample, CodeOptions, CodeSection, CliInstallation, Dependencies, ShikiCode
    landingnew/ context/ setup/
  constants/    Categories.js, Components.js, Badges.js, pageMetadata.js, colors.js, code/<Category>/...
  content/      <Category>/<Name>/<Name>.jsx   JS + CSS source   (jsrepo: JS-CSS)
  tailwind/     JS + Tailwind                                  (JS-TW)
  ts-default/   TS + CSS                                       (TS-CSS)
  ts-tailwind/  TS + Tailwind                                  (TS-TW)
  demo/         <Category>/<Name>Demo.jsx   (the docs page body)
  css/          variables.css, sidebar.css, docs.css, ... 19 files
  hooks/ utils/ sounds/ tools/ docs/ assets/
```

- Categories folders: Animations, Backgrounds, Components, Micro, TextAnimations (in content/ and demo/).
- Four variants of every component live in four parallel trees, so a component exists as 4 source copies.
- Docs page wiring: `CategoryPage` looks up `subcategory` in a `componentMap` (constants/Components.js, not read in full), lazy-loads the matching demo, and the demo imports its component from `@content/...` and its code strings from `constants/code/...` (SplitTextDemo passes `codeObject={splitText}`).
- Vite aliases: `@`, `@utils`, `@content`, `@tailwind`, `@ts-default`, `@ts-tailwind`.
- Registry: `jsrepo.config.ts` registry name `@react-bits`, output `public/r`, items named `{Title}-{JS|TS}-{CSS|TW}`; README install commands: `npx shadcn@latest add @react-bits/SplitText-TS-TW` or `npx jsrepo@latest add https://reactbits.dev/r/SplitText-TS-TW`. `npm run new:component` scaffolds a component (scripts/generateComponent.js).
- Not verified: how `constants/code` strings are produced (hand-written vs generated from source files).

---

## 6. Visual design language

Tokens from `src/css/variables.css`, `sidebar.css`, `styles.css`, `index.html`.

- Dark first. Page `#120f17` (very dark violet), cards `#1b1722`, hover `#373044`, borders `#2f293a`.
- Primary accent purple `#a855f7`; soft accent `#b497cf`; active link `#cf9dff`; text `#fff`, muted `#aaaaaa`/`#a1a1aa`.
- Light theme exists: bg `#fff`, text `#18181b`, primary `#8f36e8`.
- Selection colour: translucent purple `rgba(168,85,247,0.42)`.
- Focus ring on selects: cyan `rgba(0,216,255,0.5)`.
- Typography: Geist (body, weight 400, line-height 1.5, links 500), Geist Mono for code; display fonts loaded (Bricolage Grotesque etc.), where used was not verified.
- Radii scale: 6 / 10 / 12 / 14 / 24 / 999px; sidebar 16px; tags 4px.
- Glass surfaces: "ghost" translucent whites (4%, 7%, 12%), inset top highlight `inset 0 1px 0 rgba(255,255,255,.07)`, `backdrop-filter: blur(32px) saturate(1.3)` on controls, blur(18px) on sidebar.
- Hairline borders at 5-10% white; layered menu shadows (1px ring + inset highlight + large soft drop).
- Spacing: app container padding `0 2em` (1em below 967px), gutter 32px, content column max 1080px, header 60px.
- Motion: sliding pill in segmented controls (240ms, cubic-bezier(0.23,1,0.32,1)); dropdowns fade/slide 0.2s; "New" badge pulses; page fade between routes; boot-logo pulse; header controls use `FadeContent blur`; sidebar hover preview uses blur+scale. `prefers-reduced-motion` handled in sidebar and boot loader.
- Background treatments on the docs page itself: flat dark colour; landing-page visuals not read.

---

## 7. Worth copying vs not copying

Worth copying (patterns, not assets)
- Two-tab docs page (Preview / Code) with a segmented sliding-pill switch.
- Live stage with refresh-to-replay and width presets (Desktop / Tablet / Mobile).
- Controls grouped under the stage, driven by one props state; presets that set many props.
- Usage snippet that updates from current control values.
- Global language/style preference instead of per-page selectors.
- Fixed floating glass sidebar with category icon picker, filter box, active-item auto-scroll, hover media preview.
- Everything themed through CSS variables with a dark default and an inline pre-paint theme script (no flash).
- Lazy-loaded pages with prefetch on hover/focus; skeleton fallback.
- shadcn-compatible registry (4 variants per component) generated from folders by a script.
- Copy-for-AI menu, llms.txt, sitemap/RSS/OG generation as build steps.

Do NOT copy
- Name, logo, wordmark, "React Bits" copy, descriptions, sponsor/Pro cards and tool names (Background Studio, Shape Magic, etc.).
- Component source code, demos, preview videos and OG images: MIT + Commons Clause forbids reselling or redistributing the components as a bundle or port.
- Exact colour palette combination and font pairing as a brand identity; choose your own tokens.
- Pro/paid-tier content and the author's links.

---

## Source list

URLs read (all fetched in this session)
- https://raw.githubusercontent.com/DavidHDev/react-bits/main/package.json
- https://github.com/DavidHDev/react-bits (root tree + README summary)
- https://raw.githubusercontent.com/DavidHDev/react-bits/main/index.html
- https://raw.githubusercontent.com/DavidHDev/react-bits/main/src/App.jsx
- https://raw.githubusercontent.com/DavidHDev/react-bits/main/vite.config.js
- https://raw.githubusercontent.com/DavidHDev/react-bits/main/jsrepo.config.ts
- https://raw.githubusercontent.com/DavidHDev/react-bits/main/LICENSE.md
- https://raw.githubusercontent.com/DavidHDev/react-bits/main/src/styles.css
- https://raw.githubusercontent.com/DavidHDev/react-bits/main/src/css/variables.css
- https://raw.githubusercontent.com/DavidHDev/react-bits/main/src/css/sidebar.css
- https://raw.githubusercontent.com/DavidHDev/react-bits/main/src/css/docs.css
- https://raw.githubusercontent.com/DavidHDev/react-bits/main/src/constants/Categories.js
- https://raw.githubusercontent.com/DavidHDev/react-bits/main/src/components/navs/Sidebar.jsx
- https://raw.githubusercontent.com/DavidHDev/react-bits/main/src/components/navs/Header.jsx
- https://raw.githubusercontent.com/DavidHDev/react-bits/main/src/components/layout/SidebarLayout.jsx
- https://raw.githubusercontent.com/DavidHDev/react-bits/main/src/components/common/TabsLayout.jsx
- https://raw.githubusercontent.com/DavidHDev/react-bits/main/src/components/code/CodeSection.jsx
- https://raw.githubusercontent.com/DavidHDev/react-bits/main/src/components/code/CodeExample.jsx
- https://raw.githubusercontent.com/DavidHDev/react-bits/main/src/components/code/CliInstallation.jsx
- https://raw.githubusercontent.com/DavidHDev/react-bits/main/src/pages/CategoryPage.jsx
- https://raw.githubusercontent.com/DavidHDev/react-bits/main/src/demo/TextAnimations/SplitTextDemo.jsx
- https://raw.githubusercontent.com/DavidHDev/react-bits/main/src/content/TextAnimations/SplitText/SplitText.jsx
- GitHub tree listings: src, src/components, src/components/layout, src/components/code, src/components/navs, src/components/common, src/pages, src/constants, src/constants/code, src/content, src/content/TextAnimations, src/content/TextAnimations/SplitText, src/demo, src/demo/TextAnimations, src/css (all under https://github.com/DavidHDev/react-bits/tree/main/)

Attempted but failed
- https://reactbits.dev (host not resolvable from the sandbox; the live site was not seen)

Caveat: WebFetch results are summaries produced by a small model, not raw file dumps, so details such as exact CSS values should be re-checked against the repo before being relied on.

**Luigi Espinosa \- Portfolio**

cuatro.dev

Architecture, Stack & Step-by-Step Build Guide

Next.js 15  ·  React 19  ·  TypeScript  ·  Three.js  ·  GSAP  ·  Docker

# **1\. Project Overview & Goals**

This guide covers everything needed to build and maintain a self-hosted personal portfolio for *Luigi Espinosa \- Frontend Developer and Team Lead*. The portfolio is designed to make a strong first impression through high-quality visuals, 3D interactive scenes, and scroll-driven storytelling. It communicates professional credibility, links to real work, and surfaces contact information with minimal friction.

## **Core Objectives**

* Showcase professional experience \- timeline, role descriptions, technologies used.

* Feature personal projects with live links and brief case-study copy.

* Deliver a memorable visual experience through GSAP animations and Three.js 3D.

* Be fully self-hostable via Docker Compose \- no Vercel, no SaaS dependency.

* Load fast on mobile without compromising the desktop experience.

## **Constraints**

* Zero paid cloud dependencies, all infra runs on a single VPS.

* Portable: deploys with a single docker compose up command.

* Portfolio-quality public showcase, every architectural choice is a talking point.

* All analytics data stays on your machine (self-hosted Umami).

* Single-command developer experience using pnpm.

# **2\. Technology Stack**

Every choice below is free, open-source, and battle-tested. The philosophy: pick boring, well-supported tools so you spend time on visual polish and content \- not yak-shaving.

## **Core Stack**

| Layer | Technology | Why |
| :---- | :---- | :---- |
| Framework | Next.js 15 (App Router) | Stable App Router, standalone Docker output, React 19 support, improved bundler |
| UI Layer | React 19 | Concurrent features, use() hook, pairs with R3F v9 |
| Language | TypeScript 5.7 | moduleResolution: bundler, erasableSyntaxOnly flag |
| 3D / WebGL | Three.js 0.173 \+ R3F v9 | R3F v9 requires React 19; improved render loop and TypeScript types |
| 3D Helpers | @react-three/drei | Environment, Float, Sparkles \- avoids boilerplate |
| Post FX | @react-three/postprocessing | Bloom, chromatic aberration, vignette, SSAO on R3F scenes |
| Animations | GSAP 3.12.7 | ScrollTrigger bundled; stable; industry standard for portfolio scroll work |
| Smooth Scroll | @darkroomengineering/lenis | Required for GSAP ScrollTrigger scrubbing; butter-smooth inertia |
| Styles | Sass 1.85 (SCSS) | Dart Sass, modern API, CSS custom properties \+ resets |
| Analytics | Umami (self-hosted) | GDPR-compliant, MIT, runs in Docker Compose alongside the app |
| Reverse Proxy | Caddy | Auto-HTTPS via Let's Encrypt, trivial config, single static binary |
| Images | sharp | Required by Next.js standalone image optimization |

## **Dependency Upgrades**

The following packages are upgraded from the previous version of the project:

| Package | Previous | Recommended | Reason |
| :---- | :---- | :---- | :---- |
| next | 13.4.9 | 15.x | Remove experimental: { appDir }, stable App Router, React 19 support |
| react / react-dom | 18.2.0 | 19.x | Concurrent features, use() hook, pairs with R3F v9 |
| typescript | 5.1.6 | 5.7.x | moduleResolution: bundler, erasableSyntaxOnly flag |
| three | 0.160.0 | 0.173.x | Performance fixes, better TypeScript types |
| @react-three/fiber | 8.15.12 | 9.x | React 19 support, improved render loop |
| @react-three/drei | 9.92.7 | latest | New helpers: Environment, Float, Sparkles |
| gsap | 3.12.2 | 3.12.7 | Latest patch; ScrollTrigger plugin bundled |
| sass | 1.63.6 | 1.85.x | Dart Sass fixes, modern API |
| eslint | 8.44.0 | 9.x \+ Biome | Flat config, faster linting |

## **Additions & Removals**

### **New Packages**

| Package | Role |
| :---- | :---- |
| @react-three/postprocessing | Bloom, chromatic aberration, vignette, SSAO |
| @darkroomengineering/lenis | Smooth scroll \- required for GSAP ScrollTrigger scrubbing |
| @playwright/test | E2E and visual regression testing |
| @axe-core/playwright | Accessibility auditing in test pipeline |
| sharp | Next.js image optimization (required for standalone Docker builds) |

### **Removed Packages**

| Package | Replace with |
| :---- | :---- |
| @vercel/analytics | Self-hosted Umami (inside Docker Compose) |
| @vercel/speed-insights | Remove entirely \- use Lighthouse CI locally |
| env-cmd | Next.js .env.local natively handles this |

# **3\. Architecture**

## **3.1 High-Level Diagram**

The application is a single Next.js process in standalone mode, fronted by Caddy. Umami analytics runs as a separate container in the same Compose stack.

                     ┌────────────────────────────────────────────────┐  
                     │          Docker Host / VPS                     │  
                     │                                                │  
 Browser──HTTPS:443─▶│  ┌────────┐    ┌─────────────────────────┐    │  
                     │  │ Caddy  │───▶│  Next.js App            │    │  
                     │  │(proxy) │    │  (standalone, :3000)    │     │  
                     │  └────────┘    └─────────────────────────┘     │  
                     │      │                   │                     │  
                     │      │           /public (fonts, PDFs,         │  
                     │      │            3D models, OG images)        │  
                     │      │                                         │  
                     │      └──/analytics──▶ ┌─────────────────┐     │  
                     │                       │   Umami         │      │  
                     │                       │   (:3001)       │      │  
                     │                       └─────────────────┘      │  
                     └────────────────────────────────────────────────┘

## **3.2 Repository Structure**

luigi-portfolio/  
├── app/                          \# Next.js App Router  
│   ├── layout.tsx                \# Root layout, global metadata, Lenis provider  
│   ├── page.tsx                  \# Home (/)  
│   ├── app.scss                  \# CSS custom properties \+ resets  
│   ├── providers.tsx             \# Client-side Lenis \+ GSAP initialisation  
│   ├── scss/  
│   │   ├── \_fonts.scss           \# @font-face declarations  
│   │   └── \_index.scss           \# SCSS barrel  
│   ├── work/page.tsx             \# /work \- experience timeline  
│   ├── projects/page.tsx         \# /projects \- case studies grid  
│   ├── cv/page.tsx               \# Redirects to /pdf/cv.pdf  
│   └── not-found.tsx             \# 404 page  
│  
├── components/  
│   ├── atoms/  
│   │   ├── Container/            \# \<Body\> (sets body\#routeId) \+ \<Container\>  
│   │   ├── Logo/  
│   │   └── Navbar/               \# Nav links incl. /work and /projects  
│   ├── molecules/  
│   │   └── Header/               \# Hides itself on home page  
│   ├── organisms/  
│   │   ├── ErrorPage/            \# 404 with GSAP  
│   ├── HomeLayout/               \# Landing page (GSAP \+ Three.js)  
│   ├── GemComponent/             \# R3F canvas \- rotating gem with Bloom  
│   ├── Scene/                    \# Shared R3F \<Canvas\> wrapper  
│   ├── ContactContainer/         \# Social links  
│   ├── WorkTimeline/             \# Experience accordion \+ scroll animations  
│   └── ProjectCard/              \# Project grid item  
│  
├── content/                      \# Typed content \- no CMS needed  
│   ├── work.ts                   \# Array of work experience objects  
│   └── projects.ts               \# Array of project objects  
│  
├── hooks/  
│   ├── useGsapContext.ts         \# GSAP context tied to ref, reverts on unmount  
│   └── useReducedMotion.ts       \# Reads prefers-reduced-motion media query  
│  
├── public/  
│   ├── fonts/                    \# Self-hosted woff2/woff/ttf  
│   ├── assets/home/              \# gem.glb, environment\_D.hdr  
│   ├── assets/projects/          \# Screenshots, 3D models  
│   └── pdf/                      \# cv.pdf, recommendation-letter.pdf  
│  
├── docker/  
│   ├── Dockerfile  
│   └── Caddyfile  
├── docker-compose.yml  
├── .env.local                    \# Local overrides (never committed)  
├── .env.production               \# Production values (never committed)  
├── next.config.js  
├── tsconfig.json  
├── .prettierrc.js  
└── CLAUDE.md

## **3.3 Design Patterns**

| Pattern | Where & Why |
| :---- | :---- |
| Atomic Design | Atoms → Molecules → Organisms. Already in place; continue following it. A Scene organism wraps any R3F \<Canvas\> so camera/lighting defaults are never repeated. |
| Content-as-Code | Work experience and projects live in content/work.ts and content/projects.ts as plain TypeScript arrays. No database, no CMS. Update content by editing a TS file and deploying. |
| Per-Route Body ID | components/atoms/Container sets body\#routeId. CSS can target body\#work .timeline without component-scoped specificity fights. |
| GSAP Context Cleanup | Every component that registers GSAP animations uses gsap.context(() \=\> {...}, ref) and returns ctx.revert() from the effect cleanup. Mandatory \- stale tweens cause layout bugs across route navigations. |
| Progressive Enhancement for 3D | WebGL is not guaranteed. Wrap every \<Canvas\> in a boundary that checks for WebGL support or catches context-loss events. Show a static fallback image when 3D is unavailable. |
| Lazy Canvas Loading | All \<Canvas\> components are loaded with next/dynamic({ ssr: false }). Three.js must never run on the server. |

# **4\. Step-by-Step Build Order**

Follow this order to always have a working, demonstrable build at each milestone. Never scaffold infrastructure for features you have not started yet.

| \# | Phase | What to build |
| :---- | :---- | :---- |
| 1 | Housekeeping | Upgrade dependencies, remove Vercel coupling, wire Docker. Upgrade Next.js to 15.x and React to 19.x. Remove experimental: { appDir: true } from next.config.js. Set output: 'standalone'. Update tsconfig.json: change moduleResolution from node to bundler, update target to ES2017. Remove @vercel/analytics, @vercel/speed-insights, env-cmd. Add sharp to dependencies. Write Dockerfile and docker-compose.yml. Confirm pnpm build passes and Docker image runs locally. |
| 2 | Content & Navigation | Add the two missing content pages \- still zero new animations. Create content/work.ts (typed array of work experience). Create content/projects.ts (typed array of projects). Create app/work/page.tsx \- renders work array as a static list, no styling yet. Create app/projects/page.tsx \- renders projects array as a static list. Add /work and /projects links to Navbar. Ensure header appears correctly on both new routes. |
| 3 | GSAP Scroll Animations | Add scroll-triggered reveals on the new content pages. Install Lenis: pnpm add @darkroomengineering/lenis. Initialize in app/providers.tsx; wrap layout.tsx children in it. Create hooks/useGsapContext.ts \- a utility hook that creates a GSAP context tied to a ref and reverts it on unmount. Create hooks/useReducedMotion.ts \- reads prefers-reduced-motion, returns boolean. Animate /work: stagger entries in as user scrolls with ScrollTrigger.batch(). Animate /projects: scale-in project cards with ScrollTrigger. |
| 4 | Three.js Scene Upgrades | Create components/Scene/Scene.tsx \- shared R3F \<Canvas\> wrapper with sensible defaults (camera, tone mapping, performance monitor, WebGL context-loss handler). Upgrade GemComponent: move static material properties out of useFrame into useEffect. Add @react-three/postprocessing: Bloom on gem with low threshold. Add background particle system using \<Sparkles\> from @react-three/drei \- restrained, slow-moving. On /work page: embed minimal Three.js canvas in hero area (wireframe torus that reacts to scroll position via ScrollTrigger → useRef → useFrame). |
| 5 | Polish & Performance | Add \<meta\> Open Graph tags to every page (og:title, og:description, og:image). Generate OG image statically. Add \<link rel='canonical'\> in app/layout.tsx. Lazy-load all \<Canvas\> with next/dynamic({ ssr: false }). Run Lighthouse against Docker build; fix Core Web Vitals regressions. Add print stylesheet (@media print) for clean browser-printed CV. Wire Umami analytics script tag into app/layout.tsx pointing to analytics.cuatro.dev. |

# **5\. Key Implementation Details**

## **5.1 Dockerfile (Standalone Build)**

Next.js standalone output copies only the files needed to run the server, no node\_modules in the final image. The three-stage build keeps the final image small.

\# Stage 1 \- deps  
FROM node:22-slim AS deps  
RUN corepack enable  
WORKDIR /app  
COPY package.json pnpm-lock.yaml ./  
RUN pnpm install \--frozen-lockfile

\# Stage 2 \- builder  
FROM node:22-slim AS builder  
RUN corepack enable  
WORKDIR /app  
COPY \--from=deps /app/node\_modules ./node\_modules  
COPY . .  
RUN pnpm build

\# Stage 3 \- runner  
FROM node:22-slim AS runner  
WORKDIR /app  
ENV NODE\_ENV=production  
COPY \--from=builder /app/.next/standalone ./  
COPY \--from=builder /app/.next/static ./.next/static  
COPY \--from=builder /app/public ./public  
EXPOSE 3000  
CMD \["node", "server.js"\]

## **5.2 Lenis \+ GSAP ScrollTrigger Integration**

Lenis intercepts scroll events and provides a smooth inertia layer. GSAP's ScrollTrigger must use Lenis' scroll position, wire them together in the provider's component.

// app/providers.tsx  
'use client';  
import { useEffect } from 'react';  
import Lenis from '@darkroomengineering/lenis';  
import { gsap } from 'gsap';  
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function Providers({ children }: { children: React.ReactNode }) {  
  useEffect(() \=\> {  
    const lenis \= new Lenis();  
    lenis.on('scroll', ScrollTrigger.update);  
    gsap.ticker.add((time) \=\> lenis.raf(time \* 1000));  
    gsap.ticker.lagSmoothing(0);  
    return () \=\> { lenis.destroy(); };  
  }, \[\]);  
  return \<\>{children}\</\>;  
}

## **5.3 useGsapContext Hook**

DRY out the GSAP context pattern used across components. Every component that registers animations must call revert on unmount, or stale tweens will fire on the wrong route.

// hooks/useGsapContext.ts  
import { useEffect, useRef } from 'react';  
import { gsap } from 'gsap';

export function useGsapContext\<T extends Element\>(  
  fn: (context: gsap.Context) \=\> void,  
  deps: unknown\[\] \= \[\]  
) {  
  const ref \= useRef\<T\>(null);  
  useEffect(() \=\> {  
    const ctx \= gsap.context(fn, ref);  
    return () \=\> ctx.revert();  
    // eslint-disable-next-line react-hooks/exhaustive-deps  
  }, deps);  
  return ref;  
}

## **5.4 Scene Component (R3F Canvas Wrapper)**

Centralise all R3F Canvas defaults; camera, tone mapping, DPR cap, and context-loss handling, so no individual component needs to repeat them.

// components/Scene/Scene.tsx  
'use client';  
import { Canvas } from '@react-three/fiber';  
import { PerformanceMonitor } from '@react-three/drei';  
import { ACESFilmicToneMapping } from 'three';

export function Scene({ children }: { children: React.ReactNode }) {  
  return (  
    \<Canvas  
      camera={{ position: \[0, 0, 5\], fov: 45 }}  
      gl={{ toneMapping: ACESFilmicToneMapping, antialias: true }}  
      dpr={\[1, 2\]}  
      onCreated={({ gl }) \=\> {  
        gl.domElement.addEventListener('webglcontextlost', (e) \=\> {  
          e.preventDefault();  
          // render static fallback via parent state if needed  
        });  
      }}  
    \>  
      \<PerformanceMonitor /\>  
      {children}  
    \</Canvas\>  
  );  
}

## **5.5 Content-as-Code Schema**

Keep content in typed TypeScript arrays. No database, no CMS, no API. Update by editing the file and deploying. Types live alongside the content for easy refactoring.

// content/work.ts  
export interface WorkEntry {  
  id:          string;  
  company:     string;  
  role:        string;  
  period:      string;       // e.g. 'Jan 2022 – Present'  
  location:    string;  
  description: string;  
  highlights:  string\[\];  
  tech:        string\[\];  
}

export const work: WorkEntry\[\] \= \[  
  {  
    id:      'company-a',  
    company: 'Acme Corp',  
    role:    'Frontend Developer & Team Lead',  
    period:  'Jan 2022 – Present',  
    // ...  
  },  
\];

## **5.6 next.config.js Changes**

Key changes from the v13 config: remove experimental.appDir (stable), add output: standalone, update image domains.

// next.config.js  
/\*\* @type {import('next').NextConfig} \*/  
const nextConfig \= {  
  output: 'standalone',           // required for Docker  
  // removed: experimental: { appDir: true }  
  images: {  
    formats: \['image/avif', 'image/webp'\],  
    remotePatterns: \[\],  
  },  
  // Sass is built-in \- no extra config needed  
};

module.exports \= nextConfig;

# **6\. Free APIs & Open Source Tools Reference**

| Tool | What it does | URL |
| :---- | :---- | :---- |
| Umami | Self-hosted analytics, GDPR-compliant, MIT | github.com/umami-software/umami |
| Caddy | Reverse proxy, auto-HTTPS, zero config | caddyserver.com |
| Lenis | Smooth scroll needed for ScrollTrigger scrubbing | github.com/studio-freight/lenis |
| @react-three/postprocessing | Bloom, aberration, SSAO on R3F scenes | github.com/pmndrs/react-postprocessing |
| Playwright | E2E \+ visual regression testing, free, open-source | playwright.dev |
| axe-core | Accessibility auditing, embeds in Playwright | github.com/dequelabs/axe-core |
| GitHub API | Pull repo stars, language stats for project cards | docs.github.com/en/rest |
| Lighthouse CI | Automated performance budget checks in CI | github.com/GoogleChrome/lighthouse-ci |
| Squoosh CLI | Batch-convert images to WebP/AVIF | github.com/GoogleChromeLabs/squoosh |
| GLTF Transform | Compress, Draco-encode, optimise GLB models | gltf-transform.donmccurdy.com |
| Spline | Free 3D web design toolexports to Three.js/R3F | spline.design |
| Poly Haven | Free HDRI maps (CC0) for scene environment lighting | polyhaven.com/hdris |

# **7\. Known Gotchas & How to Avoid Them**

## **Three.js / R3F Must Never Run on the Server**

Next.js will attempt to SSR any component that is not explicitly client-only. Three.js accesses the DOM and WebGL context, which do not exist in Node.js.

Solution: wrap every \<Canvas\> import in next/dynamic with ssr: false. Do this even when the parent component is already a Client Component \- the import itself triggers the issue.

const Scene \= dynamic(() \=\> import('@/components/Scene/Scene'), { ssr: false });

## **GSAP Stale Tweens Across Route Navigations**

In Next.js App Router, components are unmounted and remounted on navigation. GSAP tweens registered in useEffect survive unmount unless explicitly reverted.

Solution: always use gsap.context(() \=\> {...}, ref) scoped to a DOM ref, and return ctx.revert() from the effect cleanup. The useGsapContext hook (Section 5.3) encapsulates this pattern.

## **epub.js CFI vs Page Numbers \- Not Applicable, But Analogous Pattern**

If you add scroll progress saving to the portfolio (e.g., saving reading position in case studies), save the scroll percentage as a decimal (0.0–1.0), not pixel offsets. Pixel offsets break after font-size or viewport changes. This is the same principle as epub.js CFI \- always save a relative, stable position.

## **Lenis and GSAP ScrollTrigger Must Be Wired Together**

If you initialise Lenis without calling ScrollTrigger.update on the scroll event, scroll-triggered animations will fire at the wrong positions. They use independent scroll position tracking by default.

Solution: lenis.on('scroll', ScrollTrigger.update) and gsap.ticker.add((time) \=\> lenis.raf(time \* 1000)). See Section 5.2.

## **Postprocessing Bloom \- Keep Threshold High**

A low bloom threshold on the gem can make the entire scene feel washed out or overcooked. Start with threshold: 0.85, strength: 0.4, radius: 0.3 and adjust visually. Bloom is additive, it accumulates if multiple lights or emissive materials are in the scene.

## **Sharp Must Be Listed in dependencies, Not devDependencies**

Next.js standalone output requires sharp at runtime for image optimisation. If it is in devDependencies it will not be present in the Docker runner stage and image optimisation will silently fall back to the slower squoosh encoder.

## **next/image and Self-Hosted Assets**

For project screenshots and other local images, import them directly from the file system (import img from './image.png') rather than using a string path in the src prop. Direct imports give Next.js the width/height at build time, avoiding layout shift.

## **Docker: .next/static Must Be Copied Manually**

Next.js standalone output does NOT include the .next/static directory. If you omit the COPY \--from=builder /app/.next/static ./.next/static step in the Dockerfile, the page will load but all JS and CSS will 404\.

# **8\. Testing Strategy**

For a solo portfolio project, the goal is targeted coverage of the things that matter, not 100% line coverage. Two layers: component tests and E2E/visual regression.

## **8.1 Component Tests \- Vitest \+ React Testing Library**

Vitest shares config with Next.js (which uses Webpack/Turbopack internally) and has zero extra tooling to wire up.

What to unit test:

* WorkTimeline \- entry rendering from content/work.ts, accordion open/close.

* ProjectCard \- prop rendering, external link href correctness.

* Navbar \- active link state per route, mobile menu toggle.

* useReducedMotion \- returns true when media query matches.

* useGsapContext \- context created on mount, reverted on unmount (mock gsap).

## **8.2 Visual Regression & E2E \- Playwright**

Playwright runs against the Docker build (not dev server) so visual snapshots match production exactly.

What to test:

* Home page renders without 3D fallback triggered (WebGL available in headless Chromium).

* Navigation between /, /work, /projects, /cv redirect.

* Keyboard navigation through the work accordion.

* axe-core accessibility audit on every page \- zero critical violations.

* OG meta tags present and correct on each route.

## **8.3 Lighthouse CI**

Run Lighthouse against the Docker build in CI. Set performance budget: Performance \>= 90, Accessibility \>= 95, Best Practices \>= 90, SEO \>= 90\. Fail the build if any score drops below budget.

\# lighthouserc.js  
module.exports \= {  
  ci: {  
    collect: { url: \['http://localhost:3000', 'http://localhost:3000/work'\] },  
    assert: {  
      assertions: {  
        'categories:performance':    \['warn',  { minScore: 0.9 }\],  
        'categories:accessibility':  \['error', { minScore: 0.95 }\],  
        'categories:best-practices': \['warn',  { minScore: 0.9 }\],  
        'categories:seo':            \['warn',  { minScore: 0.9 }\],  
      },  
    },  
  },  
};

## **8.4 CI Job (GitHub Actions)**

\# .github/workflows/ci.yml  
name: CI  
on: \[push, pull\_request\]  
jobs:  
  test:  
    runs-on: ubuntu-latest  
    steps:  
      \- uses: actions/checkout@v4  
      \- uses: pnpm/action-setup@v3  
        with: { version: 10 }  
      \- uses: actions/setup-node@v4  
        with: { node-version: 22, cache: pnpm }  
      \- run: pnpm install \--frozen-lockfile  
      \- run: pnpm test  
      \- run: pnpm typecheck  
      \- run: docker compose \-f docker-compose.yml up \-d \--build  
      \- run: pnpm exec playwright test  
      \- run: pnpm exec lhci autorun

# **9\. Domain Setup & Deployment**

## **9.1 DNS**

Your domain cuatro.dev lives in Cloudflare. Add the following A records:

| Type | Host | Value | Notes |
| :---- | :---- | :---- | :---- |
| A | analytics.cuatro.dev | YOUR\_SERVER\_IP | Umami subdomain |

Set proxy status to DNS Only (grey cloud in Cloudflare). Caddy handles TLS via ACME \- Cloudflare proxying is not needed and would interfere with certificate issuance.

## **9.2 Recommended Hosting**

| Provider | Price | Notes |
| :---- | :---- | :---- |
| Hetzner Cloud CAX11 (ARM) | \~4 EUR/mo | Best value. 2 vCPU, 4 GB RAM, 40 GB SSD. ARM64 Docker images work fine. |

## **9.3 Caddyfile Configuration**

\# Caddyfile

:80 {  
  redir https://{host}{uri} 308  
}

cuatro.dev {  
  tls {  
    \# Use dns challenge if behind Cloudflare  
  }  
  reverse\_proxy app:3000  
}

analytics.cuatro.dev {  
  reverse\_proxy umami:3001  
}

## **9.4 Docker Compose Layout**

services:  
  caddy:  
    image: caddy:2-alpine  
    ports: \['80:80', '443:443'\]  
    volumes:  
      \- ./docker/Caddyfile:/etc/caddy/Caddyfile  
      \- caddy\_data:/data  
    depends\_on: \[app, umami\]

  app:  
    build:  
      context: .  
      dockerfile: docker/Dockerfile  
    environment:  
      \- NODE\_ENV=production  
    restart: unless-stopped

  umami:  
    image: ghcr.io/umami-software/umami:postgresql-latest  
    environment:  
      \- DATABASE\_URL=postgresql://umami:umami@db:5432/umami  
      \- DATABASE\_TYPE=postgresql  
    depends\_on: \[db\]

  db:  
    image: postgres:15-alpine  
    environment:  
      \- POSTGRES\_DB=umami  
      \- POSTGRES\_USER=umami  
      \- POSTGRES\_PASSWORD=umami  
    volumes:  
      \- db\_data:/var/lib/postgresql/data

volumes:  
  caddy\_data:  
  db\_data:

## **9.5 GitHub Actions CI/CD Pipeline**

Two jobs: test and deploy. Deploy only runs if test passes and only on pushes to main. Store secrets in GitHub repository Settings \> Secrets and variables \> Actions.

Required GitHub secrets: SERVER\_HOST, SERVER\_USER, SERVER\_SSH\_KEY, SERVER\_PORT.

\# .github/workflows/deploy.yml  
deploy:  
  needs: test  
  if: github.ref \== 'refs/heads/main'  
  runs-on: ubuntu-latest  
  steps:  
    \- name: Deploy via SSH  
      uses: appleboy/ssh-action@v1  
      with:  
        host:     ${{ secrets.SERVER\_HOST }}  
        username: ${{ secrets.SERVER\_USER }}  
        key:      ${{ secrets.SERVER\_SSH\_KEY }}  
        port:     ${{ secrets.SERVER\_PORT }}  
        script: |  
          cd /opt/luigi-portfolio  
          git pull origin main  
          docker compose up \-d \--build  
          docker image prune \-f

## **9.6 Deployment Checklist**

* A record added for analytics subdomain.

* VPS provisioned (Ubuntu 22/24 LTS), Docker \+ Docker Compose installed.

* SSH key added to VPS authorized\_keys and stored in GitHub secrets.

* Repo cloned to /opt/luigi-portfolio on the server.

* .env.production file created with all secrets filled in.

* docker compose up \-d run manually for the first time.

* Caddy provisioned TLS cert \- https://cuatro.dev should load.

* Umami setup wizard completed at https://analytics.cuatro.dev.

* GitHub Actions secrets added and deploy workflow verified on first push to main.

# **10\. Portfolio Presentation Notes**

Since this is a public-facing portfolio at cuatro.dev, a few things are worth prioritising beyond just shipping working code:

## **README & First Impressions**

* Write a compelling README with an architecture diagram, full feature list, and a one-command deploy section. This is the first thing engineering hiring managers read.

* Include a live demo link, screenshots of the 3D scenes, and a technology badge row at the top.

* Use conventional commits so the GitHub history tells a clear story of iterative development from scaffold to full product.

## **The 3D Scenes Are Your Differentiator**

* The EPUB reader has theming and the webtoon comic mode. For this portfolio, the equivalent is the interactive gem with Bloom, the scroll-driven wireframe torus on the work page, and the Sparkles particle system.

* These are the interactions that make the portfolio memorable. Spend the most polish time here.

* The fallback for visitors without WebGL should still look great, use a high-quality static screenshot as the fallback image.

## **Performance as a Portfolio Statement**

* A portfolio for a Frontend Developer should have a green Lighthouse score. Anything below 90 Performance is a red flag to the people reviewing it.

* Use next/image for all images. Self-host all fonts as woff2. Lazy-load all canvas components. These are table stakes.

* Consider adding a GET /health route that returns version and uptime. It signals operational maturity.

## **Open Graph & Social Sharing**

* Every page needs og:title, og:description, og:image, og:url, and twitter:card tags. Recruiters and colleagues share portfolio links on LinkedIn \- a missing OG image is a missed impression.

* Generate a single high-quality OG image (1200×630) with your name, role, and a screenshot of the gem. Use it as the default for all pages.

## **Suggested Demo / Showcase Content**

* Projects sections.

* Work timeline: include technology pills (React, TypeScript, AWS, etc.) visible at a glance. Recruiters scan for keywords.

* Add a public stats endpoint (/api/stats) returning project count and last deployed timestamp for a live dashboard on a future portfolio landing page.

## **Analytics Goal**

* The Umami dashboard at analytics.cuatro.dev gives you data on which projects get the most engagement, which routes people navigate to from the home page, and how long they stay.

* Use this data to prioritise which project case studies to write up first.
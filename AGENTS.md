# AGENTS.md - Coding Agent Guidelines for Convert

## Project Overview

Convert is a static Progressive Web App (PWA) for browser-based video conversion
using FFmpeg.wasm. It is built with vanilla HTML, CSS, and JavaScript -- no
frameworks, no build tools, no npm dependencies, no TypeScript.

### Architecture

- **index.html** - Single-page HTML entry point (119 lines)
- **app.js** - All application logic: file handling, FFmpeg integration, UI updates (362 lines)
- **styles.css** - All styling with CSS custom properties, dark theme, responsive design (524 lines)
- **service-worker.js** - Offline caching via Cache API (78 lines)
- **manifest.json** - PWA manifest for installability
- **icon.svg / icon-192.png / icon-512.png** - App icons

The only external dependency is FFmpeg.wasm, loaded at runtime from unpkg.com CDN
via dynamic `import()`. There are no local node_modules or package.json.

## Build / Lint / Test Commands

### Build

There is **no build step**. The app is served as static files directly. The CI/CD
pipeline (`.github/workflows/deploy.yml`) simply deploys the repo root to GitHub Pages.

### Running Locally

Serve the project root with any static file server:

```sh
npx serve .
# or
python -m http.server 8000
```

Then open `http://localhost:3000` (or `:8000`) in a modern browser.

### Linting

There is **no linter configured** (no ESLint, Prettier, or similar). Follow the
code style conventions below to maintain consistency.

### Testing

There are **no automated tests**. Manual testing is done in the browser. If adding
tests in the future, consider a lightweight browser-based approach (e.g., Playwright)
since the app relies on browser APIs (File, Blob, Service Worker, FFmpeg.wasm).

### Deployment

Push to `main` triggers automatic deployment to GitHub Pages via GitHub Actions.
No build artifacts are generated -- the repo contents are uploaded directly.

## Code Style Guidelines

### Language and Module System

- Plain JavaScript (ES2020+), no TypeScript, no JSDoc type annotations
- ES modules: `<script type="module" src="app.js">` in HTML
- Dynamic `import()` for loading FFmpeg libraries from CDN at runtime
- No static `import`/`export` statements between local files (single-file app)

### Formatting

- 4-space indentation in all files (JS, HTML, CSS)
- Single quotes for JavaScript strings
- Template literals (backticks) for HTML string templates and interpolation
- Semicolons at the end of statements
- Opening braces on the same line as the statement
- Arrow functions for callbacks: `(e) => { ... }` (parentheses even for single params)
- Trailing newline at end of file

### Naming Conventions

| Context              | Convention       | Examples                                    |
|----------------------|------------------|---------------------------------------------|
| Variables/functions  | camelCase        | `dropzone`, `loadFFmpeg`, `handleFiles`     |
| Constants            | UPPER_SNAKE_CASE | `CACHE_NAME`, `ASSETS`                      |
| DOM element IDs      | camelCase        | `fileInput`, `outputFormat`, `progressList` |
| CSS classes          | kebab-case       | `drag-over`, `file-item`, `convert-btn`     |
| CSS custom props     | `--kebab-case`   | `--primary`, `--background-subtle`          |

### DOM Manipulation

- Cache DOM element references in top-level `const` declarations using `document.getElementById()`
- Use `document.createElement()` for dynamically created elements
- Use `innerHTML` for template-like HTML structure, then `.textContent` for safe user-provided text
- Use `addEventListener()` for event binding -- never inline `onclick` attributes in HTML
- Toggle visibility with `classList.add('hidden')` / `classList.remove('hidden')`
- Functions exposed globally (for cross-component access) via `window.functionName = function() { ... }`

### Async Patterns

- Use `async/await` for all asynchronous operations (not raw `.then()` chains)
- Exception: Service Worker uses `.then()` chains (standard SW pattern)
- Process files sequentially in `for` loops (not `Promise.all`) to manage memory

### Error Handling

- Wrap async operations in `try/catch/finally`
- `console.error()` for developer-facing error logging
- `alert()` for user-facing error messages (simple, no toast library)
- Return result objects with `{ success: true/false, error?: string }` from operations
- Use `finally` blocks to clean up UI state (e.g., hide loading overlays)
- Service Worker: `.catch()` on promise chains with descriptive error messages

### CSS Patterns

- CSS custom properties (variables) defined in `:root` for theming
- Dark theme by default (no light theme toggle)
- Responsive design using `@media` queries for both width and height breakpoints
- Layout with Flexbox and CSS Grid (`grid-template-columns: repeat(auto-fit, ...)`)
- Smooth transitions: `transition: <property> 0.2s` / `0.25s ease`
- Use `var(--radius)` for consistent border radius
- Use `var(--shadow)` / `var(--shadow-lg)` for consistent shadows
- `.hidden` class with `display: none !important` for show/hide

### HTML Patterns

- Semantic HTML5 elements: `<header>`, `<main>`, `<footer>`
- Inline SVG icons (no icon library), with consistent sizing and `stroke="currentColor"`
- `<select>` elements for settings, `<button>` for actions
- Hidden file input triggered by dropzone click
- Accessibility: `<label for="...">` on form controls, `lang="en"` on html

### Service Worker

- Cache name versioned as `'convert-v1'` -- increment on breaking changes
- All static assets listed in `ASSETS` array for precaching
- Strategy: cache-first with network fallback, caching successful network responses
- Skip cross-origin requests (FFmpeg CDN is not cached by the SW)
- `self.skipWaiting()` and `self.clients.claim()` for immediate activation

## File Organization

This is a flat project structure -- all source files are in the repo root. Do not
introduce subdirectories for source code unless the project grows significantly.
Keep new features within existing files when possible.

## Key Dependencies

| Dependency            | Version | Loaded From                          |
|-----------------------|---------|--------------------------------------|
| @ffmpeg/ffmpeg        | 0.12.15 | unpkg.com CDN (dynamic import)       |
| @ffmpeg/util          | 0.12.2  | unpkg.com CDN (dynamic import)       |
| @ffmpeg/core          | 0.12.10 | unpkg.com CDN (toBlobURL)            |

These are loaded at runtime in the browser. There is no package.json or local install.

## CI/CD

- **Workflow**: `.github/workflows/deploy.yml`
- **Trigger**: Push to `main` or manual `workflow_dispatch`
- **Steps**: Checkout -> Configure Pages -> Upload artifact (repo root) -> Deploy
- **No build step** in CI -- static files are deployed as-is

## Important Notes

- All video processing happens client-side in the browser via WebAssembly
- FFmpeg.wasm requires `SharedArrayBuffer`, which needs specific HTTP headers (`Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`) -- GitHub Pages handles this
- The `.gitignore` excludes `generate-icons.js` and `create-icons.html` (icon generation utilities used during development)
- When updating the service worker cache, increment the version in `CACHE_NAME` and update the `ASSETS` array if files are added/removed

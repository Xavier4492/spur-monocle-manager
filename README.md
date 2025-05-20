# Monocle Loader Plugin

[![CI](https://github.com/Xavier4492/spur-monocle-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/Xavier4492/spur-monocle-manager/actions/workflows/ci.yml)
[![Release](https://github.com/Xavier4492/spur-monocle-manager/actions/workflows/release.yml/badge.svg)](https://github.com/Xavier4492/spur-monocle-manager/actions/workflows/release.yml)
[![npm version](https://img.shields.io/npm/v/spur-monocle-manager.svg)](https://www.npmjs.com/package/spur-monocle-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**spur-monocle-manager** is a lightweight TypeScript wrapper for loading and interacting with Spur's Monocle SDK.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [API](#api)
- [Tests & CI](#tests--ci)
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
npm install spur-monocle-manager
```

## Quick Start

```typescript
import Monocle from 'spur-monocle-manager'

async function main() {
  const monocle = new Monocle({ token: 'YOUR_TOKEN_HERE' })
  await monocle.init()

  // Listen for events
  monocle.on('monocle-success', (data) => {
    console.log('Bundle data:', data)
  })

  // Retrieve the bundle and trigger the 'monocle-success' event
  const bundle = await monocle.getBundle()
  console.log(bundle)

  // Clean up when done
  monocle.destroy()
}

main().catch(console.error)
```

## API

### `new Monocle(options)`

Creates a new Monocle loader instance.

- `options.token: string` — Required Monocle authentication token.

### `init(): Promise<void>`

Injects the Monocle script into the page and initializes global callbacks.

### `getBundle(): Promise<any>`

Refreshes Monocle data and returns the bundle. Triggers `monocle-success` or `monocle-error`.

### `on(event, handler)`

Subscribes to an event (`monocle-success`, `monocle-error`, `monocle-onload`).

### `off(event, handler)`

Unsubscribes from an event.

### `destroy(): void`

Cleans up the injected script, global callbacks, and internal state.

## Tests & CI

- Unit tests & coverage via [Vitest](https://vitest.dev/)
- Linting & type-checking using ESLint + TypeScript
- Automated releases via GitHub Actions + [Semantic Release](https://semantic-release.gitbook.io/)

```bash
# Install dependencies
npm ci

# Run everything
npm run build        # Compile
npm run lint         # Lint
npm run type-check   # Type checking
npm run test:ci      # Tests + coverage

# Manual publishing (usually handled via GitHub Actions)
npm run release
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines, bug reports, and feature requests.

## License

This project is licensed under the **MIT** license. See [LICENSE](LICENSE) for more details.

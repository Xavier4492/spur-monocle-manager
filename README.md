# spur-monocle-manager

[![CI](https://github.com/Xavier4492/spur-monocle-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/Xavier4492/spur-monocle-manager/actions/workflows/ci.yml)
[![Release](https://github.com/Xavier4492/spur-monocle-manager/actions/workflows/release.yml/badge.svg)](https://github.com/Xavier4492/spur-monocle-manager/actions/workflows/release.yml)
[![npm version](https://img.shields.io/npm/v/spur-monocle-manager.svg)](https://www.npmjs.com/package/spur-monocle-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**spur-monocle-manager** is a lightweight TypeScript wrapper for loading and interacting with Spur's Monocle SDK.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [API](#api)
- [Monocle Events](#monocle-events)
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

  try {
    await monocle.init()
  } catch (err) {
    console.error('Unable to initialize Monocle (SSR or already loaded):', err)
  }

  // Listen for events
  monocle.on('monocle-success', (data) => {
    console.log('Bundle data:', data)
  })

  // Retrieve the bundle and trigger the 'monocle-success' event
  const bundle = await monocle.getBundle()
  console.log(bundle)

  const bundle2 = await monocle.getBundle() // you can call it again to get fresh bundle

  // Clean up when done (optional)
  // monocle.destroy()
}

main().catch(console.error)
```

## API

### `new Monocle(options)`

Creates a new Monocle loader instance.

- `options.token: string` — Required Monocle authentication token.
- ❗ **Throws** if no token is provided.

### `init(): Promise<void>`

Injects the Monocle script into the page and initializes global callbacks.

- Calling `init()` multiple times is safe: it returns the same promise and logs a warning.

### `getBundle(): Promise<string>`

Refreshes Monocle data and returns a signed JWT bundle as a `string`.

- Automatically calls `init()` if not already initialized.
- Triggers a `'monocle-success'` event with the bundle content on success.
- Triggers a `'monocle-error'` event on failure (e.g., if no bundle is returned).
- ❗ **Throws** if called in server-side context or if the bundle is unavailable.

### `on(event: MonocleEvents, handler: (detail: any) => void): void`

Subscribes to Monocle-specific events.

- `event`: One of `'monocle-success'`, `'monocle-error'`, `'monocle-onload'`.
- `handler`: Function that receives the event `detail` as its only parameter.

### `off(event: MonocleEvents, handler: (detail: any) => void): void`

Unsubscribes a previously registered event listener.

- Requires the exact same function reference used in `.on()`.

### `destroy(): void`

Cleans up the injected script, global callbacks, and internal state.

- Can be re-initialized later with another call to `init()`.

## Monocle Events

The Monocle class dispatches events through an internal `EventTarget`. You can subscribe to these using `.on()` and `.off()`:

| Event Name        | Description                                                                 |
| ----------------- | --------------------------------------------------------------------------- |
| `monocle-success` | Emitted when the Monocle bundle is successfully retrieved. Payload: string. |
| `monocle-error`   | Emitted when there is an error loading or fetching the bundle.              |
| `monocle-onload`  | Emitted once the Monocle script has been successfully loaded.               |

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

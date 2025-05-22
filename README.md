# spur-monocle-manager

> **Note:** This is **not** an official package. For the official Monocle documentation, please visit: [https://docs.spur.us/monocle](https://docs.spur.us/monocle)

[![CI](https://github.com/Xavier4492/spur-monocle-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/Xavier4492/spur-monocle-manager/actions/workflows/ci.yml)
[![Release](https://github.com/Xavier4492/spur-monocle-manager/actions/workflows/release.yml/badge.svg)](https://github.com/Xavier4492/spur-monocle-manager/actions/workflows/release.yml)
[![npm version](https://img.shields.io/npm/v/spur-monocle-manager.svg)](https://www.npmjs.com/package/spur-monocle-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**spur-monocle-manager** is a lightweight TypeScript wrapper for loading and interacting with Spur's Monocle SDK.

Key Features of this SDK:

- **Flexible loading:** Allows you to manually call `init()` at any point (e.g., page load) or automatically inject the script on-demand when you call `getAssessment()` (e.g., form submission).
- **Emits lifecycle events:** Provides hooks (`load`, `assessment`, `error`) for each stage of loading and fetching.

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
  monocle.on('assessment', (data) => {
    console.log('Assessment data:', data)
  })

  // Retrieve the assessment and trigger the 'assessment' event
  const assessment = await monocle.getAssessment()
  console.log(assessment)

  const assessment2 = await monocle.getAssessment() // you can call it again to get fresh assessment

  // Clean up when done (optional)
  // monocle.destroy()
}

main().catch(console.error)
```

## API

### `new Monocle(options)`

Creates a new Monocle loader instance.

- `options.token: string` — Required Monocle authentication token.
- `options.debug: boolean` — Optional flag to enable debug logging (default: `false`).
- ❗ **Throws** if no token is provided.

### `init(): Promise<void>`

Injects the Monocle script into the page and initializes global callbacks.

- Calling `init()` multiple times is safe: it returns the same promise and logs a warning.

### `getAssessment(retries?: number, delayMs?: number): Promise<string>`

Refreshes Monocle data and returns a signed JWT assessment as a `string`.

- **Parameters:**
  - `retries: number` — Optional. Number of retry attempts if no assessment is returned. Default is `5`.
  - `delayMs: number` — Optional. Delay in milliseconds between retry attempts. Default is `500` ms.
- Automatically calls `init()` if not already initialized.
- Triggers a `'assessment'` event with the assessment content on success.
- Triggers a `'error'` event on failure (e.g., if no assessment is returned).
- ❗ **Throws** if called in server-side context or if the assessment is unavailable after all retries.

### `on(event: MonocleEvents, handler: (detail: any) => void): void`

Subscribes to Monocle-specific events.

- `event`: One of `'assessment'`, `'error'`, `'load'`.
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
| `assessment`      | Emitted when the Monocle assessment is successfully retrieved. Payload: string. |
| `error`           | Emitted when there is an error loading or fetching the assessment.              |
| `load`            | Emitted once the Monocle script has been successfully loaded.               |

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

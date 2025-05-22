# Changelog

All notable changes...

## [1.3.1](https://github.com/Xavier4492/spur-monocle-manager/compare/v1.3.0...v1.3.1) (2025-05-22)

## [1.3.0](https://github.com/Xavier4492/spur-monocle-manager/compare/v1.2.5...v1.3.0) (2025-05-22)

### Features

* add optional debug flag to Monocle options for enhanced logging ([c4fcca8](https://github.com/Xavier4492/spur-monocle-manager/commit/c4fcca86cf51e25dcbec0e3fd5c97595217b86ad))

### Bug Fixes

* update default retries in getAssessment() from 3 to 5 ([2cd1244](https://github.com/Xavier4492/spur-monocle-manager/commit/2cd1244b2bb7e9c3cd3ae8389d96c4adfe595e86))

## [1.2.5](https://github.com/Xavier4492/spur-monocle-manager/compare/v1.2.4...v1.2.5) (2025-05-21)

### Bug Fixes

* enhance getBundle() to support retries and improve error handling ([11986ee](https://github.com/Xavier4492/spur-monocle-manager/commit/11986eee11bc1c9a0ace4e3258716c339ed846ea))

## [1.2.4](https://github.com/Xavier4492/spur-monocle-manager/compare/v1.2.3...v1.2.4) (2025-05-21)

### Bug Fixes

* await getBundle() to ensure proper async handling in Monocle class ([9e115a3](https://github.com/Xavier4492/spur-monocle-manager/commit/9e115a3af92aafcf0c3fd5a1a92aaa7482e95453))

## [1.2.3](https://github.com/Xavier4492/spur-monocle-manager/compare/v1.2.2...v1.2.3) (2025-05-21)

## [1.2.2](https://github.com/Xavier4492/spur-monocle-manager/compare/v1.2.1...v1.2.2) (2025-05-21)

### Bug Fixes

* update module and main entry points in package.json ([338a031](https://github.com/Xavier4492/spur-monocle-manager/commit/338a031b199bf19884188a94880c4cfb19105d3c))

## [1.2.1](https://github.com/Xavier4492/spur-monocle-manager/compare/v1.2.0...v1.2.1) (2025-05-21)

## [1.2.0](https://github.com/Xavier4492/spur-monocle-manager/compare/v1.1.0...v1.2.0) (2025-05-20)

### Features

* export MonocleEvents type for external usage ([b9043cb](https://github.com/Xavier4492/spur-monocle-manager/commit/b9043cb5102c7f97b535e829140f889759ea7026))

## [1.1.0](https://github.com/Xavier4492/spur-monocle-manager/compare/v1.0.1...v1.1.0) (2025-05-20)

### Features

* add .eslintignore to exclude dist, coverage, and node_modules ([4914540](https://github.com/Xavier4492/spur-monocle-manager/commit/49145401cb43c7495b5e046d9d4050e51beaa29b))

### Bug Fixes

* clean up .npmrc by removing pnpm-related options ([b7f2711](https://github.com/Xavier4492/spur-monocle-manager/commit/b7f271113400b11d6d0a3344ecfb9f434e77f0d6))

## [1.0.1](https://github.com/Xavier4492/spur-monocle-manager/compare/v1.0.0...v1.0.1) (2025-05-20)

### Bug Fixes

* remove 'dist' from assets in semantic-release git configuration ([d28f3c0](https://github.com/Xavier4492/spur-monocle-manager/commit/d28f3c0bcf51f5462fd36a7e848c0d6430fc65b3))

## 1.0.0 (2025-05-20)

### Features

* initialize project structure with TypeScript, ESLint, Prettier, and CI/CD workflows ([462f292](https://github.com/Xavier4492/spur-monocle-manager/commit/462f292d83b86586c40f22e12bbda300c62fbb94))
* replace ESLint configuration with new format for ESLint 9 ([f4aa2cb](https://github.com/Xavier4492/spur-monocle-manager/commit/f4aa2cbeaca403402c97e1c412a7845f81ff3d69))
* update release workflow to include permissions and improve checkout step ([6e94e68](https://github.com/Xavier4492/spur-monocle-manager/commit/6e94e68116a7dff779e99bcdb56cdb33d470ed55))

### Bug Fixes

* add conventional-changelog-conventionalcommits as a dev dependency ([f5c7ec4](https://github.com/Xavier4492/spur-monocle-manager/commit/f5c7ec4816a9dcd2b8019d33f19bc7d489118342))
* ensure EventTarget is initialized before adding event listeners in on method ([f0b8c90](https://github.com/Xavier4492/spur-monocle-manager/commit/f0b8c90d307bafaf476870df78d8808f3339f80b))
* update _dispatch method to accept optional detail parameter and improve type handling in init and getBundle methods ([4bb87dc](https://github.com/Xavier4492/spur-monocle-manager/commit/4bb87dc188417c9116552d1ed5b71e74ca5375e0))
* update release workflow to correctly set NODE_AUTH_TOKEN and NPM_TOKEN environment variables ([a96eef8](https://github.com/Xavier4492/spur-monocle-manager/commit/a96eef8a3cc82804abced9aefbb8b9eb350f2ff9))

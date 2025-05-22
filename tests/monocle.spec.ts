import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Monocle from '../src/index'

const FAKE_URL = 'https://mcl.spur.us/d/mcl.js'
// TODO: add test foor init() timeout with options.initTimeout
/* eslint-disable @typescript-eslint/no-explicit-any */
describe('Monocle', () => {
  let fakeScript: any
  let appendSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Reset the DOM
    document.head.innerHTML = ''
    vi.resetAllMocks()

    // Spy on console.warn for debug logs
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Create a fake <script> with required DOM methods
    fakeScript = {
      id: '',
      async: false,
      defer: false,
      src: '',
      addEventListener: vi.fn(),
      setAttribute: vi.fn(), // stub attribute setter
    }

    // Spy on document.createElement to return fakeScript
    vi.spyOn(document, 'createElement').mockImplementation(() => fakeScript as any)

    // Spy on appendChild to monitor its call
    appendSpy = vi
      .spyOn<any, any>(document.head, 'appendChild')
      .mockImplementation((() => fakeScript as unknown as Node) as any)

    // Simulated global MCL object
    ;(globalThis as any).MCL = {
      refresh: vi.fn().mockResolvedValue(undefined),
      getAssessment: vi.fn().mockReturnValue('fake-jwt-token'),
    }
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  it('throws if no token is provided', () => {
    expect(() => new Monocle({ token: '' })).toThrow('[Monocle] No token provided')
  })

  it('constructor logs debug enabled when debug flag is true', () => {
    new Monocle({ token: 'tok', debug: true })
    expect(consoleWarnSpy).toHaveBeenCalledWith('[Monocle] Debug mode enabled')
  })

  it('init(): injects the script and resolves', async () => {
    const m = new Monocle({ token: 'abc' })
    const p = m.init()

    // Test async/defer attributes
    expect(fakeScript.async).toBe(true)
    expect(fakeScript.defer).toBe(true)

    // Retrieve and trigger the "load" listener directly
    const loadCall = fakeScript.addEventListener.mock.calls.find(
      ([event]: [string]) => event === 'load',
    )!
    const loadCb = loadCall[1] as (ev: Event) => any
    loadCb(new Event('load'))
    ;(window as any)._onAssessment('fake-jwt-token')

    await expect(p).resolves.toBeUndefined()
    expect(fakeScript.src).toContain(`${FAKE_URL}?tk=abc`)
    expect(appendSpy).toHaveBeenCalledWith(fakeScript as any)
  })

  it('init(): loading failure rejects and cleans up', async () => {
    const m = new Monocle({ token: 'tok' })
    // Spy on removeChild
    const removeSpy = vi.spyOn(document.head, 'removeChild')

    const p = m.init()

    // Simulate the error
    const errCall = fakeScript.addEventListener.mock.calls.find(
      ([event]: [string]) => event === 'error',
    )!
    const errCb = errCall[1] as (this: HTMLElement, ev: Event) => void
    errCb.call(fakeScript, new Event('error'))

    await expect(p).rejects.toThrow('[Monocle] Failed to load script')
    expect(removeSpy).toHaveBeenCalledWith(fakeScript as any)
    expect((m as any)._initialized).toBe(false)
    expect((m as any)._readyPromise).toBeNull()
  })

  it('init(): rejects after timeout', async () => {
    vi.useFakeTimers()
    const m = new Monocle({ token: 'tok', initTimeout: 1000 })
    const p = m.init()
    // avance de 999 ms → toujours pendante
    vi.advanceTimersByTime(999)
    await expect(Promise.race([p, Promise.resolve('still pending')])).resolves.toBe('still pending')

    // avance de 1 ms de plus → timeout
    vi.advanceTimersByTime(1)
    await expect(p).rejects.toThrow('[Monocle] init() timeout after 1000 ms')
    vi.useRealTimers()
  })

  it('init(): logs idempotent warning when called twice in debug mode', async () => {
    const m = new Monocle({ token: 'abc', debug: true })
    // First init
    const p1 = m.init()
    const loadCall = fakeScript.addEventListener.mock.calls.find(([e]: [string]) => e === 'load')!
    const loadCb = loadCall[1] as () => void
    loadCb()
    // Simulate call to _onAssessment
    ;(window as any)._onAssessment('fake-jwt-token')
    await p1

    // Second init => warning and same promise
    const p2 = m.init()
    expect(consoleWarnSpy).toHaveBeenCalledWith('[Monocle] already initialized, init() ignored')
    expect(p2).toBe(p1)
  })

  it('getAssessment(): calls _dispatch on error and rejects', async () => {
    const m = new Monocle({ token: 'x' })
    // Stub init to set up _monocle
    vi.spyOn(m, 'init').mockImplementation(async () => {
      ;(m as any)._monocle = (globalThis as any).MCL
    })
    // Case: refresh rejects
    ;(globalThis as any).MCL.refresh = vi.fn().mockRejectedValue(new Error('fail-refresh'))
    const dispatchSpy = vi.spyOn(m as any, '_dispatch').mockImplementation(() => {})

    await expect(m.getAssessment()).rejects.toThrow('fail-refresh')
    expect(dispatchSpy).toHaveBeenCalledWith('error', expect.any(Error))

    // Case: getAssessment() returns null
    ;(globalThis as any).MCL.refresh = vi.fn().mockResolvedValue(undefined)
    ;(globalThis as any).MCL.getAssessment = vi.fn().mockReturnValue(null)

    await expect(m.getAssessment()).rejects.toThrow('[Monocle] No data returned')
    expect(dispatchSpy).toHaveBeenCalledWith('error', expect.any(Error))
  })

  it('on/off correctly handles events', () => {
    const m = new Monocle({ token: 't2' })
    // Manually initialize eventTarget
    ;(m as any)._eventTarget = new EventTarget()
    vi.spyOn(m as any, '_dispatch').mockImplementation(function (
      this: { _eventTarget: EventTarget },
      event: string,
      detail: any,
    ) {
      this._eventTarget.dispatchEvent(new CustomEvent(event, { detail }))
    } as any)

    const handler = vi.fn()
    m.on('assessment', handler)
    ;(m as any)._dispatch('assessment', 123)
    expect(handler).toHaveBeenCalledWith(123)

    m.off('assessment', handler)
    ;(m as any)._dispatch('assessment', 456)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('destroy(): cleans up DOM, global callbacks, and internal state', () => {
    const m = new Monocle({ token: 'x' })
    ;(m as any)._script = { parentNode: { removeChild: vi.fn() } } as any
    ;(m as any)._initialized = true
    ;(m as any)._readyPromise = Promise.resolve()

    vi.spyOn(document.head, 'querySelectorAll').mockReturnValue([
      { src: 'https://mcl.spur.us/d/mcl.js', remove: vi.fn() },
      { src: 'other', remove: vi.fn() },
    ] as any)

    m.destroy()

    expect((m as any)._script).toBeNull()
    expect((m as any)._monocle).toBeNull()
    expect((m as any)._eventTarget).toBeNull()
    expect((m as any)._handlers.size).toBe(0)
    expect((window as any)._onAssessment).toBeUndefined()
    expect((window as any).MCL).toBeUndefined()
  })

  describe('Server-side fallback (window undefined)', () => {
    let originalWindow: any

    beforeAll(() => {
      originalWindow = (globalThis as any).window
      delete (globalThis as any).window
    })
    afterAll(() => {
      ;(globalThis as any).window = originalWindow
    })

    it('init() rejects when window is undefined', async () => {
      const m = new Monocle({ token: 't' })
      await expect(m.init()).rejects.toThrow('[Monocle] init() not supported in SSR')
    })

    it('getAssessment() throws when window is undefined', async () => {
      const m = new Monocle({ token: 't' })
      await expect(m.getAssessment()).rejects.toThrow(
        '[Monocle] getAssessment() is not available on the server side',
      )
    })
  })

  describe('init(): idempotence', () => {
    let fakeScriptLocal: any

    beforeEach(() => {
      document.head.innerHTML = ''
      fakeScriptLocal = {
        addEventListener: vi.fn(),
        async: false,
        defer: false,
        src: '',
        setAttribute: vi.fn(),
      }
      vi.spyOn(document, 'createElement').mockImplementation(() => fakeScriptLocal as any)
      vi.spyOn(document.head, 'appendChild').mockImplementation(() => fakeScriptLocal as any)
      ;(globalThis as any).MCL = {
        refresh: vi.fn().mockResolvedValue(undefined),
        getAssessment: vi.fn(),
      }
    })

    it('returns the same promise if called twice', async () => {
      const m = new Monocle({ token: 'xyz' })
      const p1 = m.init()
      const loadCall = fakeScriptLocal.addEventListener.mock.calls.find(
        ([e]: [string]) => e === 'load',
      )!
      const loadCb2 = loadCall[1] as () => void
      loadCb2()
      ;(window as any)._onAssessment('fake-jwt-token')

      const p2 = m.init()
      expect(p2).toBe(p1)
      await expect(p1).resolves.toBeUndefined()
    })
  })

  describe('Event registration edge-cases', () => {
    it('on() without existing eventTarget reinitializes it and registers handler (no init call)', () => {
      const m = new Monocle({ token: 'abc' })
      // Force eventTarget à null
      ;(m as any)._eventTarget = null
      const initSpy = vi.spyOn(m, 'init')
      const handler = vi.fn()

      m.on('assessment', handler)

      // on() ne doit pas déclencher init()
      expect(initSpy).not.toHaveBeenCalled()
      // eventTarget doit être recréé
      expect((m as any)._eventTarget).toBeInstanceOf(EventTarget)

      // Et le handler doit bien être enregistré : un dispatch appelle handler
      ;(m as any)._dispatch('assessment', 123)
      expect(handler).toHaveBeenCalledWith(123)
    })

    it('off() does not throw if removing non-existent handler', () => {
      const m = new Monocle({ token: 'abc' })
      ;(m as any)._eventTarget = new EventTarget()
      expect(() => m.off('assessment', () => {})).not.toThrow()
    })
  })

  describe('destroy(): early return', () => {
    it('destroy() does nothing if not initialized', () => {
      const m = new Monocle({ token: 'abc' })
      expect(() => m.destroy()).not.toThrow()
    })
  })
})

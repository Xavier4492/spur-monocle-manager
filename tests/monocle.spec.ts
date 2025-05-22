import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Monocle from '../src/index'

const FAKE_URL = 'https://mcl.spur.us/d/mcl.js'

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

    // Create a fake <script>
    fakeScript = {
      id: '',
      async: false,
      defer: false,
      src: '',
      addEventListener: vi.fn(),
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

    // Retrieve and trigger the "load" callback
    const loadCall = fakeScript.addEventListener.mock.calls.find(
      ([event]: [string]) => event === 'load',
    )!
    const loadCb = loadCall[1].bind(fakeScript) as (this: HTMLElement, ev: Event) => any
    loadCb.call(fakeScript, new Event('load'))

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

  it('init(): logs idempotent warning when called twice in debug mode', async () => {
    const m = new Monocle({ token: 'abc', debug: true })
    // First init
    const p1 = m.init()
    // Trigger load
    const loadCall = fakeScript.addEventListener.mock.calls.find(([e]: [string]) => e === 'load')!
    const loadCb = loadCall[1] as () => void
    loadCb()
    await p1

    // Second init should warn
    const p2 = m.init()
    expect(consoleWarnSpy).toHaveBeenCalledWith('[Monocle] already initialized, init() ignored')
    expect(p2).toBe(p1)
  })

  it('Global callbacks correctly call _dispatch with the right detail', () => {
    const m = new Monocle({ token: 't' })
    // Prepare _dispatch spy
    const dispatchSpy = vi.spyOn(m as any, '_dispatch').mockImplementation(() => {})

    m.init() // instantiate global callbacks

    // Simulate each callback
    ;(window as any).monocleSuccessCallback('success-data')
    ;(window as any).monocleErrorCallback('error-data')
    ;(window as any).monocleOnloadCallback()

    expect(dispatchSpy).toHaveBeenCalledWith('monocle-success', 'success-data')
    expect(dispatchSpy).toHaveBeenCalledWith('monocle-error', 'error-data')
    expect(dispatchSpy).toHaveBeenCalledWith('monocle-onload', undefined)
  })

  it('getAssessment(): calls _dispatch on error and rejects', async () => {
    const m = new Monocle({ token: 'x' })
    vi.spyOn(m, 'init').mockResolvedValue()
    // Case: refresh rejects
    ;(globalThis as any).MCL.refresh = vi.fn().mockRejectedValue(new Error('fail-refresh'))
    const dispatchSpy = vi.spyOn(m as any, '_dispatch').mockImplementation(() => {})

    await expect(m.getAssessment()).rejects.toThrow('fail-refresh')
    expect(dispatchSpy).toHaveBeenCalledWith('monocle-error', expect.any(Error))

    // Case: getAssessment() returns null
    ;(globalThis as any).MCL.refresh = vi.fn().mockResolvedValue(undefined)
    ;(globalThis as any).MCL.getAssessment = vi.fn().mockReturnValue(null)

    await expect(m.getAssessment()).rejects.toThrow('[Monocle] No data returned')
    expect(dispatchSpy).toHaveBeenCalledWith('monocle-error', expect.any(Error))
  })

  it('monocle-onload callback dispatches event without load', () => {
    const m = new Monocle({ token: 'y' })
    const dispatchSpy = vi.spyOn(m as any, '_dispatch').mockImplementation(() => {})

    m.init()
    ;(window as any).monocleOnloadCallback()

    expect(dispatchSpy).toHaveBeenCalledWith('monocle-onload', undefined)
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
    m.on('monocle-success', handler)
    ;(m as any)._dispatch('monocle-success', 123)
    expect(handler).toHaveBeenCalledWith(123)

    m.off('monocle-success', handler)
    ;(m as any)._dispatch('monocle-success', 456)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('destroy(): cleans up DOM, global callbacks, and internal state', () => {
    const m = new Monocle({ token: 'x' })
    // Simulate script and ready state
    ;(m as any)._script = { parentNode: { removeChild: vi.fn() } } as any
    ;(m as any)._initialized = true
    ;(m as any)._readyPromise = Promise.resolve()

    // Simulate other scripts in head
    vi.spyOn(document.head, 'querySelectorAll').mockReturnValue([
      { src: 'https://mcl.spur.us/d/mcl.js', remove: vi.fn() },
      { src: 'other', remove: vi.fn() },
    ] as any)

    m.destroy()

    // Verify everything was cleaned up
    expect((m as any)._script).toBeNull()
    expect((m as any)._monocle).toBeNull()
    expect((m as any)._eventTarget).toBeNull()
    expect((m as any)._handlers.size).toBe(0)
    expect((window as any).monocleSuccessCallback).toBeUndefined()
    expect((window as any).monocleErrorCallback).toBeUndefined()
    expect((window as any).monocleOnloadCallback).toBeUndefined()
    expect((window as any).MCL).toBeUndefined()
  })

  describe('Server-side fallback (window undefined)', () => {
    let originalWindow: any

    beforeAll(() => {
      // Simule un environnement sans window
      originalWindow = (globalThis as any).window
      delete (globalThis as any).window
    })
    afterAll(() => {
      // Restaure window
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
      fakeScriptLocal = { addEventListener: vi.fn(), async: false, defer: false, src: '' }
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

      const p2 = m.init()
      expect(p2).toBe(p1)
      await expect(p1).resolves.toBeUndefined()
    })
  })

  describe('Event registration edge-cases', () => {
    it('on() calls init() if _eventTarget is null', () => {
      const m = new Monocle({ token: 'abc' })
      const initSpy = vi.spyOn(m, 'init').mockResolvedValue()
      ;(m as any)._eventTarget = null
      m.on('monocle-success', () => {})
      expect(initSpy).toHaveBeenCalled()
    })

    it('off() does not throw if removing non-existent handler', () => {
      const m = new Monocle({ token: 'abc' })
      ;(m as any)._eventTarget = new EventTarget()
      expect(() => m.off('monocle-success', () => {})).not.toThrow()
    })
  })

  describe('destroy(): early return', () => {
    it('destroy() does nothing if not initialized', () => {
      const m = new Monocle({ token: 'abc' })
      expect(() => m.destroy()).not.toThrow()
    })
  })
})

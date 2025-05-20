import { describe, it, expect, beforeEach, vi } from 'vitest'
import Monocle from '../src/index'

const FAKE_URL = 'https://mcl.spur.us/d/mcl.js'

/* eslint-disable @typescript-eslint/no-explicit-any */
describe('Monocle', () => {
  let fakeScript: any
  let appendSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Reset the DOM
    document.head.innerHTML = ''
    vi.resetAllMocks()

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
      getBundle: vi.fn().mockReturnValue({ foo: 'bar' }),
    }
  })

  it('throws if no token is provided', () => {
    expect(() => new Monocle({ token: '' })).toThrow('[Monocle] No token provided')
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
    expect((m as any)._ready).toBe(false)
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

  it('getBundle(): calls _dispatch on error and rejects', async () => {
    const m = new Monocle({ token: 'x' })
    vi.spyOn(m, 'init').mockResolvedValue()
    // Case: refresh rejects
    ;(globalThis as any).MCL.refresh = vi.fn().mockRejectedValue(new Error('fail-refresh'))
    const dispatchSpy = vi.spyOn(m as any, '_dispatch').mockImplementation(() => {})

    await expect(m.getBundle()).rejects.toThrow('fail-refresh')
    expect(dispatchSpy).toHaveBeenCalledWith('monocle-error', expect.any(Error))

    // Case: getBundle() returns null
    ;(globalThis as any).MCL.refresh = vi.fn().mockResolvedValue(undefined)
    ;(globalThis as any).MCL.getBundle = vi.fn().mockReturnValue(null)

    await expect(m.getBundle()).rejects.toThrow('[Monocle] No data returned')
    expect(dispatchSpy).toHaveBeenCalledWith('monocle-error', expect.any(Error))
  })

  it('monocle-onload event is dispatched after loading', async () => {
    const m = new Monocle({ token: 'y' })
    const promise = m.init()

    // Capture 'load' event listener
    const loadCall = fakeScript.addEventListener.mock.calls.find(
      ([event]: [string]) => event === 'load',
    )!
    const loadCb = loadCall[1] as (this: HTMLElement, ev: Event) => void

    // Override _dispatch to catch the event
    ;(m as any)._dispatch = (event: string) => {
      expect(event).toBe('monocle-onload')
    }

    // Simulate global onload
    ;(window as any).monocleOnloadCallback!()
    // Then trigger script load
    loadCb.call(fakeScript, new Event('load'))
    await promise
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
    ;(m as any)._ready = Promise.resolve()

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
})

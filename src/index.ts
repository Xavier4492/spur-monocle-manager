const MONOCLE_SCRIPT_URL = 'https://mcl.spur.us/d/mcl.js'

export type MonocleEvents = 'monocle-success' | 'monocle-error' | 'monocle-onload'

export interface MonocleOptions {
  token: string // Authentication token for Monocle API
}

/**
 * Monocle integration loader and manager.
 * Dynamically injects the Monocle script and provides methods to interact with it.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export default class Monocle {
  private token: string
  private _initialized = false
  private _readyPromise: Promise<void> | null = null // Promise resolving when script is ready
  private _script: HTMLScriptElement | null = null // <script> element reference
  private _monocle: any = null // Global MCL object once loaded
  private _eventTarget: EventTarget | null = null // EventTarget for custom events
  private _handlers = new Map<string, EventListener>() // Stored event handlers for off()

  /**
   * @param options Configuration options, requiring a valid token
   * @throws Error if no token is provided
   */
  constructor(options: MonocleOptions) {
    if (!options.token) {
      throw new Error('[Monocle] No token provided')
    }
    this.token = options.token
  }

  /**
   * Dispatches a custom Monocle event on the internal EventTarget.
   */
  private _dispatch(event: MonocleEvents, detail?: any) {
    this._eventTarget?.dispatchEvent(new CustomEvent(event, { detail }))
  }

  /**
   * Load the Monocle script into the document.
   * Returns a promise that resolves when the script is loaded or rejects on failure.
   */
  public init(): Promise<void> {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('[Monocle] init() not supported in SSR'))
    }

    // If already initialized, return the existing promise
    if (this._initialized) {
      console.warn('[Monocle] already initialized, init() ignored')
      // To share the same loading promise:
      return this._readyPromise as Promise<void>
    }

    this._initialized = true

    // Creates and stores the static promise
    this._readyPromise = new Promise((resolve, reject) => {
      this._eventTarget = new EventTarget()
      const script = document.createElement('script')
      this._script = script
      script.id = '_mcl'
      script.async = true
      script.defer = true
      script.src = `${MONOCLE_SCRIPT_URL}?tk=${encodeURIComponent(this.token)}`

      // Setup global callbacks to forward events
      ;(window as any).monocleSuccessCallback = (data: any) =>
        this._dispatch('monocle-success', data)
      ;(window as any).monocleErrorCallback = (err: any) => this._dispatch('monocle-error', err)
      ;(window as any).monocleOnloadCallback = () => this._dispatch('monocle-onload', undefined)

      script.addEventListener('load', () => {
        // Store the global MCL object reference
        this._monocle = (window as any).MCL
        resolve()
      })
      script.addEventListener('error', () => {
        // Cleanup on failure
        try {
          document.head.removeChild(script)
        } catch {
          // ignore if not present
        }
        this._initialized = false
        this._readyPromise = null
        reject(new Error('[Monocle] Failed to load script'))
      })

      document.head.appendChild(script)
    })

    return this._readyPromise
  }

  /**
   * Refresh and retrieve the latest Monocle bundle (JWT-string).
   * @returns The Monocle bundle as a string
   * @throws Error if called in SSR or si aucun bundle n'est retourné
   */
  public async getBundle(): Promise<string> {
    if (typeof window === 'undefined') {
      throw new Error('[Monocle] getBundle() is not available on the server side')
    }

    await this.init()

    // Use stored instance or fallback to global
    const mcl = this._monocle || (window as any).MCL
    try {
      await mcl.refresh()
      const bundle = (await mcl.getBundle()) as string | null
      if (!bundle) {
        throw new Error('[Monocle] No data returned')
      }
      this._dispatch('monocle-success', bundle)
      return bundle
    } catch (err: any) {
      this._dispatch('monocle-error', err)
      throw err
    }
  }

  /**
   * Register an event listener for Monocle events.
   */
  public on(event: MonocleEvents, handler: (detail: any) => void): void {
    if (typeof window === 'undefined') return

    // Ensure an EventTarget exists and script is initialized
    if (!this._eventTarget) {
      this._eventTarget = new EventTarget()
      this.init().catch(() => {})
    }

    // Wrap handler to extract detail from CustomEvent
    const wrapper: EventListener = (e: Event) => handler((e as CustomEvent).detail)
    const key = `${event}:${handler}`
    this._handlers.set(key, wrapper)
    this._eventTarget.addEventListener(event, wrapper)
  }

  /**
   * Unregister a previously added event listener.
   */
  public off(event: MonocleEvents, handler: (detail: any) => void): void {
    if (typeof window === 'undefined') return

    const key = `${event}:${handler}`
    const wrapper = this._handlers.get(key)
    if (wrapper) {
      this._eventTarget?.removeEventListener(event, wrapper)
      this._handlers.delete(key)
    }
  }

  /**
   * Clean up the Monocle script and all associated resources.
   */
  public destroy(): void {
    if (typeof window === 'undefined' || !this._initialized) return

    // Remove the specific script instance
    this._script?.parentNode?.removeChild(this._script)
    // Remove any residual Monocle scripts by URL
    document.head.querySelectorAll('script').forEach((s) => {
      if (s.src.includes('mcl.spur.us')) s.remove()
    })

    // Remove global callbacks and MCL reference
    delete (window as any).monocleSuccessCallback
    delete (window as any).monocleErrorCallback
    delete (window as any).monocleOnloadCallback
    delete (window as any).MCL

    // Reset internal state
    this._eventTarget = null
    this._monocle = null
    this._script = null
    this._handlers.clear()

    // Re-authorizes a later re-init
    this._initialized = false
    this._readyPromise = null
  }
}

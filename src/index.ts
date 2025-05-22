// TODO: add logs when debug is enabled
const MONOCLE_SCRIPT_URL = 'https://mcl.spur.us/d/mcl.js'

export type MonocleEvents = 'assessment' | 'error' | 'load'

export interface MonocleOptions {
  token: string // Authentication token for Monocle API
  initTimeout?: number // Optional timeout for script loading (default: 5000ms)
  debug?: boolean // Optional debug flag for logging
}

/**
 * Monocle integration loader and manager.
 * Dynamically injects the Monocle script and provides methods to interact with it.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export default class Monocle {
  private token: string
  private initTimeout: number // Timeout for script loading
  private _initialized = false
  private _readyPromise: Promise<void> | null = null // Promise resolving when script is ready
  private _script: HTMLScriptElement | null = null // <script> element reference
  private _monocle: any = null // Global MCL object once loaded
  private _eventTarget: EventTarget | null = null // EventTarget for custom events
  private _handlers = new Map<
    MonocleEvents,
    Array<{ original: (detail: any) => void; wrapper: EventListener }>
  >()
  private _debug: boolean // Debug mode flag

  /**
   * @param options Configuration options, requiring a valid token
   * @throws Error if no token is provided
   */
  constructor(options: MonocleOptions) {
    if (!options.token) {
      throw new Error('[Monocle] No token provided')
    }
    this.token = options.token
    this.initTimeout = options.initTimeout || 5000 // Default timeout for script loading
    if (options.debug) {
      console.warn('[Monocle] Debug mode enabled')
    }
    this._debug = options.debug || false
    this._eventTarget = new EventTarget()
  }

  /**
   * Dispatches a custom Monocle event on the internal EventTarget.
   */
  private _dispatch(event: MonocleEvents, detail?: any) {
    this._eventTarget?.dispatchEvent(new CustomEvent(event, { detail }))
  }

  /**
   * Load the Monocle script into the document.
   * Returns a promise that resolves when the script is loaded or rejects on failure or timeout.
   */
  public init(): Promise<void> {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('[Monocle] init() not supported in SSR'))
    }

    // If already initialized, return the existing promise
    if (this._initialized) {
      if (this._debug) {
        console.warn('[Monocle] already initialized, init() ignored')
      }
      // To share the same loading promise:
      return this._readyPromise as Promise<void>
    }

    this._initialized = true

    // Creates and stores the static promise
    this._readyPromise = new Promise((resolve, reject) => {
      // Timer of timeout
      const timer = setTimeout(() => {
        // cleanup script
        if (this._script?.parentNode) {
          document.head.removeChild(this._script)
        }
        this._initialized = false
        this._readyPromise = null

        const err = new Error(`[Monocle] init() timeout after ${this.initTimeout} ms`)
        this._dispatch('error', err)
        reject(err)
      }, this.initTimeout)

      ;(window as any)._onAssessment = (jwt: string) => {
        clearTimeout(timer)
        this._dispatch('assessment', jwt)
        // close init() promise
        resolve()
      }

      // Script injection
      const script = document.createElement('script') as HTMLScriptElement
      this._script = script
      script.id = '_mcl'
      script.async = true
      script.defer = true
      script.src = `${MONOCLE_SCRIPT_URL}?tk=${encodeURIComponent(this.token)}`

      script.addEventListener('load', () => {
        // Store the global MCL object reference
        this._monocle = (window as any).MCL
        this._dispatch('load')
        // resolve() to close init() promise at the end of the script loading, assessment is not yet available
      })

      script.addEventListener('error', () => {
        clearTimeout(timer)
        // Cleanup on failure
        try {
          document.head.removeChild(script)
        } catch {
          // ignore if not present
        }
        this._initialized = false
        this._readyPromise = null

        let err = new Error('[Monocle] Failed to load script')
        this._dispatch('error', err)
        reject(err)
      })

      script.setAttribute('onassessment', '_onAssessment')
      script.setAttribute('onbundle', '_onAssessment')

      document.head.appendChild(script)
    })

    return this._readyPromise
  }

  /**
   * Refresh and retrieve the latest Monocle assessment (JWT string),
   * retrying up to `retries` times if the assessment comes back empty.
   *
   * @param retries   Number of attempts (default: 3)
   * @param delayMs   Delay between attempts in milliseconds (default: 500)
   * @returns         The Monocle assessment (JWT) as a string
   * @throws          Error if run on the server side or if no assessment is returned
   *                   after all retries, or if refresh/getAssessment throws.
   */
  public async getAssessment(retries = 5, delayMs = 500): Promise<string> {
    if (typeof window === 'undefined') {
      throw new Error('[Monocle] getAssessment() is not available on the server side')
    }

    // Ensure the script is injected and MCL is defined
    await this.init()

    if (!this._monocle) {
      throw new Error('[Monocle] MCL is not defined')
    }

    // TODO: remove loop, it's not needed since init() waits for onassessment
    // Try to refresh + getAssessment up to `retries` times
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this._monocle.refresh()
        const assessment = (await this._monocle.getAssessment()) as string | null
        if (assessment) {
          return assessment
        }
      } catch (err: any) {
        // Underlying error (network, parsing, etc.)
        this._dispatch('error', err)
        throw err
      }
      // No assessment yet: wait before retrying
      await new Promise((res) => setTimeout(res, delayMs))
    }

    // All retries exhausted, still no assessment
    const error = new Error('[Monocle] No data returned after retries')
    this._dispatch('error', error)
    throw error
  }

  /**
   * Register an event listener for Monocle events.
   */
  public on(event: MonocleEvents, handler: (detail: any) => void): void {
    if (typeof window === 'undefined') return
    if (!this._eventTarget) this._eventTarget = new EventTarget()

    // Prevent duplicate registrations for same handler
    const existing = this._handlers.get(event) || []
    if (existing.some((e) => e.original === handler)) {
      if (this._debug) console.warn(`[Monocle] handler already registered for ${event}`)
      return
    }

    // Wrap handler to extract detail from CustomEvent
    const wrapper: EventListener = (e: Event) => handler((e as CustomEvent).detail)
    existing.push({ original: handler, wrapper })
    this._handlers.set(event, existing)
    this._eventTarget!.addEventListener(event, wrapper)
  }

  /**
   * Unregister a previously added event listener.
   */
  public off(event: MonocleEvents, handler: (detail: any) => void): void {
    if (typeof window === 'undefined') return
    const list = this._handlers.get(event)
    if (!list) return
    // Remove all wrappers matching this handler
    const remaining = [] as typeof list
    list.forEach(({ original, wrapper }) => {
      if (original === handler) {
        this._eventTarget!.removeEventListener(event, wrapper)
      } else {
        remaining.push({ original, wrapper })
      }
    })
    if (remaining.length) {
      this._handlers.set(event, remaining)
    } else {
      this._handlers.delete(event)
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

    // Remove global MCL references
    delete (window as any)._onAssessment
    delete (window as any).MCL

    // Clean all listeners
    if (this._eventTarget) {
      this._handlers.forEach((arr, event) => {
        arr.forEach(({ wrapper }) => this._eventTarget!.removeEventListener(event, wrapper))
      })
    }

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

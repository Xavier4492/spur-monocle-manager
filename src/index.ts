const MONOCLE_SCRIPT_URL = 'https://mcl.spur.us/d/mcl.js'

export type MonocleEvents = 'monocle-success' | 'monocle-error' | 'monocle-onload'

export interface MonocleOptions {
  token: string // Authentication token for Monocle API
  debug?: boolean // Optional debug flag for logging
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
    if (options.debug) {
      console.warn('[Monocle] Debug mode enabled')
    }
    this._debug = options.debug || false
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
      if (this._debug) {
        console.warn('[Monocle] already initialized, init() ignored')
      }
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
    const mcl = this._monocle || (window as any).MCL

    // Try to refresh + getAssessment up to `retries` times
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await mcl.refresh()
        const assessment = (await mcl.getAssessment()) as string | null
        if (assessment) {
          this._dispatch('monocle-success', assessment)
          return assessment
        }
      } catch (err: any) {
        // Underlying error (network, parsing, etc.)
        this._dispatch('monocle-error', err)
        throw err
      }
      // No assessment yet: wait before retrying
      await new Promise((res) => setTimeout(res, delayMs))
    }

    // All retries exhausted, still no assessment
    const error = new Error('[Monocle] No data returned after retries')
    this._dispatch('monocle-error', error)
    throw error
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

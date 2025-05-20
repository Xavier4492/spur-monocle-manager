// src/index.ts
var MONOCLE_SCRIPT_URL = "https://mcl.spur.us/d/mcl.js";
var Monocle = class {
  // Stored event handlers for off()
  /**
   * @param options Configuration options, requiring a valid token
   * @throws Error if no token is provided
   */
  constructor(options) {
    this._script = null;
    // <script> element reference
    this._monocle = null;
    // Global MCL object once loaded
    this._eventTarget = null;
    // EventTarget for custom events
    this._ready = false;
    // Promise resolving when script is ready
    this._handlers = /* @__PURE__ */ new Map();
    if (!options.token) {
      throw new Error("[Monocle] No token provided");
    }
    this.token = options.token;
  }
  /**
   * Dispatches a custom Monocle event on the internal EventTarget.
   */
  _dispatch(event, detail) {
    var _a;
    (_a = this._eventTarget) == null ? void 0 : _a.dispatchEvent(new CustomEvent(event, { detail }));
  }
  /**
   * Load the Monocle script into the document.
   * Returns a promise that resolves when the script is loaded or rejects on failure.
   */
  init() {
    if (typeof window === "undefined") return Promise.resolve();
    if (this._ready) return this._ready;
    this._eventTarget = new EventTarget();
    const script = document.createElement("script");
    this._script = script;
    script.id = "_mcl";
    script.async = true;
    script.defer = true;
    script.src = `${MONOCLE_SCRIPT_URL}?tk=${encodeURIComponent(this.token)}`;
    window.monocleSuccessCallback = (data) => this._dispatch("monocle-success", data);
    window.monocleErrorCallback = (err) => this._dispatch("monocle-error", err);
    window.monocleOnloadCallback = () => this._dispatch("monocle-onload", void 0);
    this._ready = new Promise((resolve, reject) => {
      script.addEventListener("load", () => {
        this._monocle = window.MCL;
        resolve();
      });
      script.addEventListener("error", () => {
        try {
          document.head.removeChild(script);
        } catch {
        }
        this._ready = false;
        reject(new Error("[Monocle] Failed to load script"));
      });
      document.head.appendChild(script);
    });
    return this._ready;
  }
  /**
   * Refresh and retrieve the latest Monocle bundle data.
   * @returns The data bundle from Monocle
   * @throws Error if refresh or data retrieval fails
   */
  async getBundle() {
    if (typeof window === "undefined") return Promise.resolve();
    await this.init();
    const mclInstance = this._monocle || window.MCL;
    try {
      await mclInstance.refresh();
      const bundle = mclInstance.getBundle();
      if (!bundle) {
        throw new Error("[Monocle] No data returned");
      }
      this._dispatch("monocle-success", bundle);
      return bundle;
    } catch (err) {
      this._dispatch("monocle-error", err);
      throw err;
    }
  }
  /**
   * Register an event listener for Monocle events.
   */
  on(event, handler) {
    if (typeof window === "undefined") return;
    if (!this._eventTarget) {
      this._eventTarget = new EventTarget();
      this.init().catch(() => {
      });
    }
    const wrapper = (e) => handler(e.detail);
    const key = `${event}:${handler}`;
    this._handlers.set(key, wrapper);
    this._eventTarget.addEventListener(event, wrapper);
  }
  /**
   * Unregister a previously added event listener.
   */
  off(event, handler) {
    var _a;
    if (typeof window === "undefined") return;
    const key = `${event}:${handler}`;
    const wrapper = this._handlers.get(key);
    if (wrapper) {
      (_a = this._eventTarget) == null ? void 0 : _a.removeEventListener(event, wrapper);
      this._handlers.delete(key);
    }
  }
  /**
   * Clean up the Monocle script and all associated resources.
   */
  destroy() {
    var _a, _b;
    if (typeof window === "undefined" || !this._ready) return;
    (_b = (_a = this._script) == null ? void 0 : _a.parentNode) == null ? void 0 : _b.removeChild(this._script);
    document.head.querySelectorAll("script").forEach((s) => {
      if (s.src.includes("mcl.spur.us")) s.remove();
    });
    delete window.monocleSuccessCallback;
    delete window.monocleErrorCallback;
    delete window.monocleOnloadCallback;
    delete window.MCL;
    this._eventTarget = null;
    this._monocle = null;
    this._script = null;
    this._ready = false;
    this._handlers.clear();
  }
};
export {
  Monocle as default
};
//# sourceMappingURL=index.js.map
type MonocleEvents = 'monocle-success' | 'monocle-error' | 'monocle-onload';
interface MonocleOptions {
    token: string;
}
/**
 * Monocle integration loader and manager.
 * Dynamically injects the Monocle script and provides methods to interact with it.
 */
declare class Monocle {
    private token;
    private _script;
    private _monocle;
    private _eventTarget;
    private _ready;
    private _handlers;
    /**
     * @param options Configuration options, requiring a valid token
     * @throws Error if no token is provided
     */
    constructor(options: MonocleOptions);
    /**
     * Dispatches a custom Monocle event on the internal EventTarget.
     */
    private _dispatch;
    /**
     * Load the Monocle script into the document.
     * Returns a promise that resolves when the script is loaded or rejects on failure.
     */
    init(): Promise<void>;
    /**
     * Refresh and retrieve the latest Monocle bundle data.
     * @returns The data bundle from Monocle
     * @throws Error if refresh or data retrieval fails
     */
    getBundle(): Promise<any>;
    /**
     * Register an event listener for Monocle events.
     */
    on(event: MonocleEvents, handler: (detail: any) => void): void;
    /**
     * Unregister a previously added event listener.
     */
    off(event: MonocleEvents, handler: (detail: any) => void): void;
    /**
     * Clean up the Monocle script and all associated resources.
     */
    destroy(): void;
}

export { type MonocleOptions, Monocle as default };

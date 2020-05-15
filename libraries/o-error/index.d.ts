export = OError;
/**
 * Light-weight helpers for handling JavaScript Errors in node.js and the
 * browser.
 */
declare class OError extends Error {
    /**
     * Tag debugging information onto any error (whether an OError or not) and
     * return it.
     *
     * @param {Error} error the error to tag
     * @param {string} [message] message with which to tag `error`
     * @param {Object} [info] extra data with wich to tag `error`
     * @return {Error} the modified `error` argument
     */
    static tag(error: Error, message?: string, info?: any): Error;
    /**
     * The merged info from any `tag`s on the given error.
     *
     * If an info property is repeated, the last one wins.
     *
     * @param {Error | null | undefined} error any errror (may or may not be an `OError`)
     * @return {Object}
     */
    static getFullInfo(error: Error): any;
    /**
     * Return the `stack` property from `error`, including the `stack`s for any
     * tagged errors added with `OError.tag` and for any `cause`s.
     *
     * @param {Error | null | undefined} error any error (may or may not be an `OError`)
     * @return {string}
     */
    static getFullStack(error: Error): string;
    /**
     * @param {string} message as for built-in Error
     * @param {Object} [info] extra data to attach to the error
     * @param {Error} [cause] the internal error that caused this error
     */
    constructor(message: string, info?: any, cause?: Error);
    info: any;
    cause: Error;
    /** @private @type {Array<TaggedError>} */
    private _oErrorTags;
    /**
     * Set the extra info object for this error.
     *
     * @param {Object | null | undefined} info extra data to attach to the error
     * @return {this}
     */
    withInfo(info: any): OError;
    /**
     * Wrap the given error, which caused this error.
     *
     * @param {Error} cause the internal error that caused this error
     * @return {this}
     */
    withCause(cause: Error): OError;
}

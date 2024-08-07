// @ts-nocheck
/**
 * A polyfill for `ReadableStream.protototype[Symbol.asyncIterator]`,
 * aligning as closely as possible to the specification.
 *
 * from https://gist.github.com/MattiasBuelens/496fc1d37adb50a733edd43853f2f60e
 *
 * @see https://streams.spec.whatwg.org/#rs-asynciterator
 * @see https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream#async_iteration
 */

ReadableStream.prototype.values ??= function ({ preventCancel = false } = {}) {
  const reader = this.getReader()
  return {
    async next() {
      try {
        const result = await reader.read()
        if (result.done) {
          reader.releaseLock()
        }
        return result
      } catch (e) {
        reader.releaseLock()
        throw e
      }
    },
    async return(value) {
      if (!preventCancel) {
        const cancelPromise = reader.cancel(value)
        reader.releaseLock()
        await cancelPromise
      } else {
        reader.releaseLock()
      }
      return { done: true, value }
    },
    [Symbol.asyncIterator]() {
      return this
    },
  }
}

ReadableStream.prototype[Symbol.asyncIterator] ??=
  ReadableStream.prototype.values

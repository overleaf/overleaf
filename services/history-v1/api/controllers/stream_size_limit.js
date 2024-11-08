const stream = require('node:stream')

/**
 * Transform stream that stops passing bytes through after some threshold has
 * been reached.
 */
class StreamSizeLimit extends stream.Transform {
  constructor(maxSize) {
    super()
    this.maxSize = maxSize
    this.accumulatedSize = 0
    this.sizeLimitExceeded = false
  }

  _transform(chunk, encoding, cb) {
    this.accumulatedSize += chunk.length
    if (this.accumulatedSize > this.maxSize) {
      this.sizeLimitExceeded = true
    } else {
      this.push(chunk)
    }
    cb()
  }
}

module.exports = StreamSizeLimit

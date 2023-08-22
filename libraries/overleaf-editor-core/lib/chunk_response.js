'use strict'

const assert = require('check-types').assert
const Chunk = require('./chunk')

/**
 * The ChunkResponse allows for additional data to be sent back with the chunk
 * at present there are no extra data to send.
 */
class ChunkResponse {
  constructor(chunk) {
    assert.instance(chunk, Chunk)
    this.chunk = chunk
  }

  toRaw() {
    return {
      chunk: this.chunk.toRaw(),
    }
  }

  static fromRaw(raw) {
    if (!raw) return null

    return new ChunkResponse(Chunk.fromRaw(raw.chunk))
  }

  getChunk() {
    return this.chunk
  }
}

module.exports = ChunkResponse

'use strict'

const assert = require('check-types').assert
const Chunk = require('./chunk')

//
// The ChunkResponse allows for additional data to be sent back with the chunk
// at present there are no extra data to send.
//

function ChunkResponse(chunk) {
  assert.instance(chunk, Chunk)
  this.chunk = chunk
}

ChunkResponse.prototype.toRaw = function chunkResponseToRaw() {
  return {
    chunk: this.chunk.toRaw(),
  }
}

ChunkResponse.fromRaw = function chunkResponseFromRaw(raw) {
  if (!raw) return null

  return new ChunkResponse(Chunk.fromRaw(raw.chunk))
}

ChunkResponse.prototype.getChunk = function () {
  return this.chunk
}

module.exports = ChunkResponse

const OError = require('@overleaf/o-error')

class ChunkVersionConflictError extends OError {}

module.exports = {
  ChunkVersionConflictError,
}

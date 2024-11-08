const chai = require('chai')
const SandboxedModule = require('sandboxed-module')

// Chai configuration
chai.should()

// ensure every ObjectId has the id string as a property for correct comparisons
require('mongodb-legacy').ObjectId.cacheHexString = true

// SandboxedModule configuration
SandboxedModule.configure({
  requires: {
    '@overleaf/logger': {
      debug() {},
      log() {},
      info() {},
      warn() {},
      err() {},
      error() {},
      fatal() {},
    },
    'mongodb-legacy': require('mongodb-legacy'), // for ObjectId comparisons
  },
  globals: { Buffer, JSON, console, process },
  sourceTransformers: {
    removeNodePrefix: function (source) {
      return source.replace(/require\(['"]node:/g, "require('")
    },
  },
})

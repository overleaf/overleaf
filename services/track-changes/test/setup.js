const chai = require('chai')
const SandboxedModule = require('sandboxed-module')

// Chai configuration
chai.should()

// SandboxedModule configuration
SandboxedModule.configure({
  requires: {
    'logger-sharelatex': {
      debug() {},
      log() {},
      info() {},
      warn() {},
      err() {},
      error() {},
      fatal() {}
    }
  },
  globals: { Buffer, JSON, console, process }
})

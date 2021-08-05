const chai = require('chai')
const SandboxedModule = require('sandboxed-module')

// Setup should interface
chai.should()

// Global SandboxedModule settings
SandboxedModule.configure({
  requires: {
    'logger-sharelatex': {
      log() {},
      info() {},
      warn() {},
      error() {},
      err() {},
    },
  },
  globals: { Buffer, console, process },
})

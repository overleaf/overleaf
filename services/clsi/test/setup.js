const chai = require('chai')
const sinonChai = require('sinon-chai')
const SandboxedModule = require('sandboxed-module')

// Setup chai
chai.should()
chai.use(sinonChai)

// Global SandboxedModule settings
SandboxedModule.configure({
  requires: {
    '@overleaf/logger': {
      debug() {},
      log() {},
      info() {},
      warn() {},
      error() {},
      err() {},
    },
  },
  globals: { Buffer, console, process, URL },
})

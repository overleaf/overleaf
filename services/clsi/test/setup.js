const chai = require('chai')
const sinonChai = require('sinon-chai')
const chaiAsPromised = require('chai-as-promised')
const SandboxedModule = require('sandboxed-module')

// Setup chai
chai.should()
chai.use(sinonChai)
chai.use(chaiAsPromised)

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
  sourceTransformers: {
    removeNodePrefix: function (source) {
      return source.replace(/require\(['"]node:/g, "require('")
    },
  },
})

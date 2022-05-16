const SandboxedModule = require('sandboxed-module')

SandboxedModule.configure({
  requires: {
    '@overleaf/logger': {
      debug() {},
      info() {},
      log() {},
      warn() {},
      error() {},
    },
    '@overleaf/metrics': { timeAsyncMethod() {} },
  },
  globals: { Buffer, console, process },
})

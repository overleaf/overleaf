const SandboxedModule = require('sandboxed-module')

SandboxedModule.configure({
  requires: {
    '@overleaf/logger': { log() {} },
    '@overleaf/metrics': { timeAsyncMethod() {} },
  },
  globals: { Buffer, console, process },
})

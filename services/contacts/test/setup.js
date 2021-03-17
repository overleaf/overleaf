const SandboxedModule = require('sandboxed-module')

SandboxedModule.configure({
  requires: {
    'logger-sharelatex': { log() {} },
    '@overleaf/metrics': { timeAsyncMethod() {} }
  },
  globals: { Buffer, console, process }
})

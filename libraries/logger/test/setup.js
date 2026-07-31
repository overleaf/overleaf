const chai = require('chai')
const sinonChai = require('sinon-chai')
const SandboxedModule = require('sandboxed-module')

// Chai configuration
chai.should()
chai.use(sinonChai)

SandboxedModule.configure({
  requires: {
    // pulls in mongodb (via zod ObjectId helpers), which does not compile in
    // the sandbox (missing TextEncoder)
    '@overleaf/validation-tools': require('@overleaf/validation-tools'),
  },
  globals: { Buffer, JSON, console, process },
  sourceTransformers: {
    removeNodePrefix: function (source) {
      return source.replace(/require\(['"]node:/g, "require('")
    },
  },
})

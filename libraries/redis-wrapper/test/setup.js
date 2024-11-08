const SandboxedModule = require('sandboxed-module')

SandboxedModule.configure({
  sourceTransformers: {
    removeNodePrefix: function (source) {
      return source.replace(/require\(['"]node:/g, "require('")
    },
  },
})

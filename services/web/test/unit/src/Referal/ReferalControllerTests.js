const SandboxedModule = require('sandboxed-module')
require('chai').should()
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Referal/ReferalController.js'
)

describe('Referal controller', function() {
  beforeEach(function() {
    this.controller = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'logger-sharelatex': {
          log() {},
          err() {}
        }
      }
    })
  })
})

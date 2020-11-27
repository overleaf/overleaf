const chai = require('chai')
const sinon = require('sinon')

// add chai.should()
chai.should()

// Load sinon-chai assertions so expect(stubFn).to.have.been.calledWith('abc')
// has a nicer failure messages
chai.use(require('sinon-chai'))

// Load promise support for chai
chai.use(require('chai-as-promised'))

// Do not truncate assertion errors
chai.config.truncateThreshold = 0

// add support for mongoose in sinon
require('sinon-mongoose')

afterEach(function() {
  sinon.restore()
})

const SandboxedModule = require('sandboxed-module')
const PromisesUtils = require('../../app/src/util/promises')
const Errors = require('../../app/src/Features/Errors/Errors')
const GLOBAL_REQUIRE_CACHE_FOR_SANDBOXED_MODULES = {
  // cache p-limit for all expressify/promisifyAll users
  '../../util/promises': PromisesUtils,
  '../../../../app/src/util/promises': PromisesUtils,

  // Errors are widely used and instance checks need the exact same prototypes
  '../Errors/Errors': Errors,
  '../../../../app/src/Features/Errors/Errors': Errors,
  '../../../../../app/src/Features/Errors/Errors': Errors
}
const LIBRARIES = [
  '@overleaf/o-error',
  'async',
  'lodash',
  'moment',
  'underscore',
  'xml2js',
  'json2csv',
  'sanitize-html',
  'marked'
]
LIBRARIES.forEach(lib => {
  GLOBAL_REQUIRE_CACHE_FOR_SANDBOXED_MODULES[lib] = require(lib)
})

SandboxedModule.configure({
  requires: GLOBAL_REQUIRE_CACHE_FOR_SANDBOXED_MODULES
})

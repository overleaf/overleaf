// Register PnP ESM loader via module.register() for synchronous ESM resolution
// (--experimental-loader from yarn only works for async resolution)
const { register } = require('node:module')
const { pathToFileURL } = require('node:url')
const path = require('node:path')
const pnpRegister = path.resolve(__dirname, '../../.pnp.register.mjs')
try {
  register(pathToFileURL(pnpRegister), pathToFileURL(__filename))
} catch {
  // .pnp.register.mjs may not exist in non-PnP environments
}

const chai = require('chai')
chai.should()
chai.use(require('chai-as-promised'))
chai.use(require('sinon-chai'))
chai.use(require('chai-exclude'))

// Do not truncate assertion errors
chai.config.truncateThreshold = 0

// ensure every ObjectId has the id string as a property for correct comparisons
require('mongodb-legacy').ObjectId.cacheHexString = true

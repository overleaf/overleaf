const chai = require('chai')
chai.should()
chai.use(require('chai-as-promised'))
chai.use(require('sinon-chai'))
chai.use(require('chai-exclude'))

// Do not truncate assertion errors
chai.config.truncateThreshold = 0

// ensure every ObjectId has the id string as a property for correct comparisons
require('mongodb-legacy').ObjectId.cacheHexString = true

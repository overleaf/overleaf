const chai = require('chai')

/*
 * Chai configuration
 */

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

// ensure every ObjectId has the id string as a property for correct comparisons
require('mongodb-legacy').ObjectId.cacheHexString = true

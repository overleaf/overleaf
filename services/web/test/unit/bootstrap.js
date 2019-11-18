const chai = require('chai')
const sinon = require('sinon')

// Load sinon-chai assertions so expect(stubFn).to.have.been.calledWith('abc')
// has a nicer failure messages
chai.use(require('sinon-chai'))

// Load promise support for chai
chai.use(require('chai-as-promised'))

// Do not truncate assertion errors
chai.config.truncateThreshold = 0

// add support for mongoose in sinon
require('sinon-mongoose')

// Crash the process on an unhandled promise rejection
process.on('unhandledRejection', err => {
  console.error('Unhandled promise rejection:', err)
  process.exit(1)
})

afterEach(function() {
  sinon.restore()
})

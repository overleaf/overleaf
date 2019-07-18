const chai = require('chai')
require('sinon')

// Load sinon-chai assertions so expect(stubFn).to.have.been.calledWith('abc')
// has a nicer failure messages
chai.use(require('sinon-chai'))

// add support for promises in sinon
require('sinon-as-promised')
// add support for mongoose in sinon
require('sinon-mongoose')

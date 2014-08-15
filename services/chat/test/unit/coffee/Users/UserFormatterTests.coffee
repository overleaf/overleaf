sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Users/UserFormatter.js"
SandboxedModule = require('sandboxed-module')
events = require "events"

describe "UserFormatter", ->
	beforeEach ->
		@UserFormatter = SandboxedModule.require modulePath, requires: {}


sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Messages/MessageFormatter.js"
SandboxedModule = require('sandboxed-module')
events = require "events"
ObjectId = require("mongojs").ObjectId

describe "MessageFormatter", ->
	beforeEach ->
		@MessageFormatter = SandboxedModule.require modulePath, requires: {}


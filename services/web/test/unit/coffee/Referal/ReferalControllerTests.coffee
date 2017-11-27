SandboxedModule = require('sandboxed-module')
assert = require('assert')
require('chai').should()
sinon = require('sinon')
modulePath = require('path').join __dirname, '../../../../app/js/Features/Referal/ReferalController.js'

describe 'Referal controller', ->

	beforeEach ->
		@controller = SandboxedModule.require modulePath, requires:
			'logger-sharelatex':
				log:->
				err:->

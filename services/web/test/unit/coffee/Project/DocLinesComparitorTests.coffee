sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/Features/Project/DocLinesComparitor.js"
SandboxedModule = require('sandboxed-module')

describe 'doc lines comparitor', ->

	beforeEach ->
		@comparitor = SandboxedModule.require modulePath, requires:
			'logger-sharelatex':{log:->}

	it 'should return true when the lines are the same', ->
		lines1 = ["hello", "world"]
		lines2 = ["hello", "world"]
		result = @comparitor.areSame lines1, lines2
		result.should.equal true

	it 'should return false when the lines are different', ->
		lines1 = ["hello", "world"]
		lines2 = ["diff", "world"]
		result = @comparitor.areSame lines1, lines2
		result.should.equal false

	it 'should return false when the lines are different', ->
		lines1 = ["hello", "world"]
		lines2 = ["hello", "wrld"]
		result = @comparitor.areSame lines1, lines2
		result.should.equal false

	it 'should return true when the lines are same', ->
		lines1 = ["hello", "world"]
		lines2 = ['hello', "world"]
		result = @comparitor.areSame lines1, lines2
		result.should.equal true

	it 'should return false if the doc lines are different in length', ->
		lines1 = ["hello", "world"]
		lines2 = ['hello', "world", "please"]
		result = @comparitor.areSame lines1, lines2
		result.should.equal false

	it 'should return false if the first array is undefined', ->
		lines1 = undefined
		lines2 = ['hello', "world"]
		result = @comparitor.areSame lines1, lines2
		result.should.equal false

	it 'should return false if the second array is undefined', ->
		lines1 = ["hello"]
		lines2 = undefined
		result = @comparitor.areSame lines1, lines2
		result.should.equal false

	it 'should return false if the second array is not an array', ->
		lines1 = ["hello"]
		lines2 = ""
		result = @comparitor.areSame lines1, lines2
		result.should.equal false

	it "should return true when comparing equal orchard docs", ->
		lines1 = [{ text: "hello world" }]
		lines2 = [{ text: "hello world" }]
		result = @comparitor.areSame lines1, lines2
		result.should.equal true
		
	it "should return false when comparing different orchard docs", ->
		lines1 = [{ text: "goodbye world" }]
		lines2 = [{ text: "hello world" }]
		result = @comparitor.areSame lines1, lines2
		result.should.equal false

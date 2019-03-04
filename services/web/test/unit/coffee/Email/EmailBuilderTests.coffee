should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/Email/EmailBuilder"
expect = require("chai").expect
_ = require('underscore')
_.templateSettings =
  interpolate: /\{\{(.+?)\}\}/g

describe "EmailBuilder", ->

	beforeEach ->

		@settings =
			appName: "testApp"
			brandPrefix: ''
		@EmailBuilder = SandboxedModule.require modulePath, requires:
			"settings-sharelatex":@settings
			"logger-sharelatex": log:->

	describe "projectInvite", ->
		beforeEach ->
			@opts =
				to:"bob@bob.com"
				first_name:"bob"
				owner:
					email:"sally@hally.com"
				inviteUrl: "http://example.com/invite"
				project:
					url:"http://www.project.com"
					name:"standard project"

		describe "when sending a normal email", ->
			beforeEach ->
				@email = @EmailBuilder.buildEmail("projectInvite", @opts)

			it 'should have html and text properties', ->
				expect(@email.html?).to.equal true
				expect(@email.text?).to.equal true

			it "should not have undefined in it", ->
				@email.html.indexOf("undefined").should.equal -1
				@email.subject.indexOf("undefined").should.equal -1

		describe "when someone is up to no good", ->
			beforeEach ->
				@opts.project.name = "<img src='http://evilsite.com/evil.php'>"
				@email = @EmailBuilder.buildEmail("projectInvite", @opts)

			it 'should not contain unescaped html in the html part', ->
				expect(@email.html).to.contain "&lt;img"


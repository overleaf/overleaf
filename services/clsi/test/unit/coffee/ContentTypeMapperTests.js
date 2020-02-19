SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../app/js/ContentTypeMapper'

describe 'ContentTypeMapper', ->

	beforeEach ->
		@ContentTypeMapper = SandboxedModule.require modulePath

	describe 'map', ->

		it 'should map .txt to text/plain', ->
			content_type = @ContentTypeMapper.map('example.txt')
			content_type.should.equal 'text/plain'

		it 'should map .csv to text/csv', ->
			content_type = @ContentTypeMapper.map('example.csv')
			content_type.should.equal 'text/csv'

		it 'should map .pdf to application/pdf', ->
			content_type = @ContentTypeMapper.map('example.pdf')
			content_type.should.equal 'application/pdf'

		it 'should fall back to octet-stream', ->
			content_type = @ContentTypeMapper.map('example.unknown')
			content_type.should.equal 'application/octet-stream'

		describe 'coercing web files to plain text', ->

			it 'should map .js to plain text', ->
				content_type = @ContentTypeMapper.map('example.js')
				content_type.should.equal 'text/plain'

			it 'should map .html to plain text', ->
				content_type = @ContentTypeMapper.map('example.html')
				content_type.should.equal 'text/plain'

			it 'should map .css to plain text', ->
				content_type = @ContentTypeMapper.map('example.css')
				content_type.should.equal 'text/plain'

		describe 'image files', ->

			it 'should map .png to image/png', ->
				content_type = @ContentTypeMapper.map('example.png')
				content_type.should.equal 'image/png'

			it 'should map .jpeg to image/jpeg', ->
				content_type = @ContentTypeMapper.map('example.jpeg')
				content_type.should.equal 'image/jpeg'
				
			it 'should map .svg to text/plain to protect against XSS (SVG can execute JS)', ->
				content_type = @ContentTypeMapper.map('example.svg')
				content_type.should.equal 'text/plain'

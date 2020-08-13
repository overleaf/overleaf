/* eslint-disable
    camelcase,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
require('chai').should()
const modulePath = require('path').join(
  __dirname,
  '../../../app/js/ContentTypeMapper'
)

describe('ContentTypeMapper', function () {
  beforeEach(function () {
    return (this.ContentTypeMapper = SandboxedModule.require(modulePath))
  })

  return describe('map', function () {
    it('should map .txt to text/plain', function () {
      const content_type = this.ContentTypeMapper.map('example.txt')
      return content_type.should.equal('text/plain')
    })

    it('should map .csv to text/csv', function () {
      const content_type = this.ContentTypeMapper.map('example.csv')
      return content_type.should.equal('text/csv')
    })

    it('should map .pdf to application/pdf', function () {
      const content_type = this.ContentTypeMapper.map('example.pdf')
      return content_type.should.equal('application/pdf')
    })

    it('should fall back to octet-stream', function () {
      const content_type = this.ContentTypeMapper.map('example.unknown')
      return content_type.should.equal('application/octet-stream')
    })

    describe('coercing web files to plain text', function () {
      it('should map .js to plain text', function () {
        const content_type = this.ContentTypeMapper.map('example.js')
        return content_type.should.equal('text/plain')
      })

      it('should map .html to plain text', function () {
        const content_type = this.ContentTypeMapper.map('example.html')
        return content_type.should.equal('text/plain')
      })

      return it('should map .css to plain text', function () {
        const content_type = this.ContentTypeMapper.map('example.css')
        return content_type.should.equal('text/plain')
      })
    })

    return describe('image files', function () {
      it('should map .png to image/png', function () {
        const content_type = this.ContentTypeMapper.map('example.png')
        return content_type.should.equal('image/png')
      })

      it('should map .jpeg to image/jpeg', function () {
        const content_type = this.ContentTypeMapper.map('example.jpeg')
        return content_type.should.equal('image/jpeg')
      })

      return it('should map .svg to text/plain to protect against XSS (SVG can execute JS)', function () {
        const content_type = this.ContentTypeMapper.map('example.svg')
        return content_type.should.equal('text/plain')
      })
    })
  })
})

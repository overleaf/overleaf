import { describe, beforeEach, it } from 'vitest'
import path from 'node:path'

const modulePath = path.join(
  import.meta.dirname,
  '../../../app/js/ContentTypeMapper'
)

describe('ContentTypeMapper', function () {
  beforeEach(async function (ctx) {
    return (ctx.ContentTypeMapper = (await import(modulePath)).default)
  })

  return describe('map', function () {
    it('should map .txt to text/plain', function (ctx) {
      const contentType = ctx.ContentTypeMapper.map('example.txt')
      return contentType.should.equal('text/plain')
    })

    it('should map .csv to text/csv', function (ctx) {
      const contentType = ctx.ContentTypeMapper.map('example.csv')
      return contentType.should.equal('text/csv')
    })

    it('should map .pdf to application/pdf', function (ctx) {
      const contentType = ctx.ContentTypeMapper.map('example.pdf')
      return contentType.should.equal('application/pdf')
    })

    it('should fall back to octet-stream', function (ctx) {
      const contentType = ctx.ContentTypeMapper.map('example.unknown')
      return contentType.should.equal('application/octet-stream')
    })

    describe('coercing web files to plain text', function () {
      it('should map .js to plain text', function (ctx) {
        const contentType = ctx.ContentTypeMapper.map('example.js')
        return contentType.should.equal('text/plain')
      })

      it('should map .html to plain text', function (ctx) {
        const contentType = ctx.ContentTypeMapper.map('example.html')
        return contentType.should.equal('text/plain')
      })

      return it('should map .css to plain text', function (ctx) {
        const contentType = ctx.ContentTypeMapper.map('example.css')
        return contentType.should.equal('text/plain')
      })
    })

    return describe('image files', function () {
      it('should map .png to image/png', function (ctx) {
        const contentType = ctx.ContentTypeMapper.map('example.png')
        return contentType.should.equal('image/png')
      })

      it('should map .jpeg to image/jpeg', function (ctx) {
        const contentType = ctx.ContentTypeMapper.map('example.jpeg')
        return contentType.should.equal('image/jpeg')
      })

      return it('should map .svg to text/plain to protect against XSS (SVG can execute JS)', function (ctx) {
        const contentType = ctx.ContentTypeMapper.map('example.svg')
        return contentType.should.equal('text/plain')
      })
    })
  })
})

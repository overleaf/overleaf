/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Client = require('./helpers/Client')
const request = require('request')
require('chai').should()
const { expect } = require('chai')
const ClsiApp = require('./helpers/ClsiApp')
const crypto = require('crypto')

describe('Syncing', function() {
  before(function(done) {
    const content = `\
\\documentclass{article}
\\begin{document}
Hello world
\\end{document}\
`
    this.request = {
      resources: [
        {
          path: 'main.tex',
          content
        }
      ]
    }
    this.project_id = Client.randomId()
    return ClsiApp.ensureRunning(() => {
      return Client.compile(
        this.project_id,
        this.request,
        (error, res, body) => {
          this.error = error
          this.res = res
          this.body = body
          return done()
        }
      )
    })
  })

  describe('from code to pdf', function() {
    return it('should return the correct location', function(done) {
      return Client.syncFromCode(
        this.project_id,
        'main.tex',
        3,
        5,
        (error, pdfPositions) => {
          if (error != null) {
            throw error
          }
          expect(pdfPositions).to.deep.equal({
            pdf: [
              { page: 1, h: 133.77, v: 134.76, height: 6.92, width: 343.71 }
            ]
          })
          return done()
        }
      )
    })
  })

  return describe('from pdf to code', function() {
    return it('should return the correct location', function(done) {
      return Client.syncFromPdf(
        this.project_id,
        1,
        100,
        200,
        (error, codePositions) => {
          if (error != null) {
            throw error
          }
          expect(codePositions).to.deep.equal({
            code: [{ file: 'main.tex', line: 3, column: -1 }]
          })
          return done()
        }
      )
    })
  })
})

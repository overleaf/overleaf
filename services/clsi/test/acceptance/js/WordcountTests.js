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
const { expect } = require('chai')
const path = require('node:path')
const fs = require('node:fs')
const ClsiApp = require('./helpers/ClsiApp')

describe('Syncing', function () {
  before(function (done) {
    this.request = {
      resources: [
        {
          path: 'main.tex',
          content: fs.readFileSync(
            path.join(__dirname, '../fixtures/naugty_strings.txt'),
            'utf-8'
          ),
        },
      ],
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

  return describe('wordcount file', function () {
    return it('should return wordcount info', function (done) {
      return Client.wordcount(this.project_id, 'main.tex', (error, result) => {
        if (error != null) {
          throw error
        }
        expect(result).to.deep.equal({
          texcount: {
            encode: 'utf8',
            textWords: 2281,
            headWords: 2,
            outside: 0,
            headers: 2,
            elements: 0,
            mathInline: 6,
            mathDisplay: 0,
            errors: 0,
            messages: '',
          },
        })
        return done()
      })
    })
  })
})

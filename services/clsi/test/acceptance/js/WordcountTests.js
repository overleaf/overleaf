import Client from './helpers/Client.js'
import { expect } from 'chai'
import path from 'node:path'
import fs from 'node:fs'
import ClsiApp from './helpers/ClsiApp.js'

describe('Syncing', function () {
  before(async function () {
    this.request = {
      resources: [
        {
          path: 'main.tex',
          content: fs.readFileSync(
            path.join(import.meta.dirname, '../fixtures/naugty_strings.txt'),
            'utf-8'
          ),
        },
      ],
    }
    this.project_id = Client.randomId()
    await ClsiApp.ensureRunning()
    this.body = await Client.compile(this.project_id, this.request)
  })

  describe('wordcount file', function () {
    it('should return wordcount info', async function () {
      const result = await Client.wordcount(this.project_id, 'main.tex')
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
    })
  })
})

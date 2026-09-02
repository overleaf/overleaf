import Client from './helpers/Client.js'
import { expect } from 'chai'
import path from 'node:path'
import fs from 'node:fs'
import ClsiApp from './helpers/ClsiApp.js'

const EXPECTED_TEXCOUNT = {
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
}

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
        texcount: EXPECTED_TEXCOUNT,
      })
    })
  })
})

describe('Wordcount without a compile', function () {
  before(async function () {
    this.request = {
      rootResourcePath: 'main.tex',
      resources: [
        {
          path: 'main.tex',
          content: fs.readFileSync(
            path.join(import.meta.dirname, '../fixtures/naugty_strings.txt'),
            'utf-8'
          ),
        },
        {
          path: 'other.tex',
          content: '\\section{Hello}\nOne two three four five.\n',
        },
      ],
    }
    this.project_id = Client.randomId()
    await ClsiApp.ensureRunning()
    // deliberately no Client.compile(): this clsi has never seen the project,
    // as when the editor served the PDF straight from clsi-cache
  })

  it('should sync the resources and return wordcount info', async function () {
    const result = await Client.wordcount(
      this.project_id,
      'main.tex',
      this.request
    )
    expect(result).to.deep.equal({ texcount: EXPECTED_TEXCOUNT })
  })

  it('should leave the whole project on disk for later requests', async function () {
    // no request body this time: the resources synced above are still there
    const result = await Client.wordcount(this.project_id, 'other.tex')
    expect(result.texcount.messages).to.equal('')
    expect(result.texcount.textWords).to.equal(5)
    expect(result.texcount.headers).to.equal(1)
  })
})

describe('Wordcount without a compile or a request body', function () {
  before(async function () {
    this.project_id = Client.randomId()
    await ClsiApp.ensureRunning()
  })

  it('should report that the file is missing', async function () {
    const result = await Client.wordcount(this.project_id, 'main.tex')
    expect(result.texcount.textWords).to.equal(0)
    expect(result.texcount.messages).to.match(/File not found/)
  })
})

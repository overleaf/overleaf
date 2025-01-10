import { expect } from 'chai'
import cheerio from 'cheerio'
import UserHelper from './helpers/User.mjs'

const User = UserHelper.promises

describe('Spelling', function () {
  let user, projectId
  async function learnWord(word) {
    const { response } = await user.doRequest('POST', {
      url: '/spelling/learn',
      json: { word },
    })
    return response
  }

  async function getDict() {
    const { body, response } = await user.doRequest(
      'GET',
      `/project/${projectId}`
    )
    expect(response.statusCode).to.equal(200)
    const dom = cheerio.load(body)
    const metaEl = dom('meta[name="ol-learnedWords"]')[0]
    return JSON.parse(metaEl.attribs.content)
  }

  describe('learning words', function () {
    beforeEach(async function () {
      user = new User()
      await user.login()
      projectId = await user.createProject('foo')
    })

    it('should return status 400 when posting an empty word', async function () {
      const response = await learnWord('')
      expect(response.statusCode).to.equal(400)
    })

    it('should return status 204 when posting a word successfully', async function () {
      const response = await learnWord('abcd')
      expect(response.statusCode).to.equal(204)
    })

    it('should not learn the same word twice', async function () {
      await learnWord('foobar')
      const learnResponse = await learnWord('foobar')
      expect(learnResponse.statusCode).to.equal(204)

      const dict = await getDict()
      expect(dict.length).to.equals(1)
    })
  })
})

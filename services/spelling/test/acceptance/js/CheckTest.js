const { expect } = require('chai')
const request = require('./helpers/request')

const USER_ID = 101

const checkWord = (words, language) =>
  request.post({
    url: `/user/${USER_ID}/check`,
    body: JSON.stringify({
      words,
      language
    })
  })

describe('checking words', () => {
  let response

  describe('on successful response', () => {
    beforeEach(async () => {
      response = await checkWord(['anather'])
    })

    it('should return status 200', async () => {
      expect(response.statusCode).to.equal(200)
    })

    it('should return the list of misspellings', async () => {
      const body = JSON.parse(response.body)
      expect(body).to.deep.equal({
        misspellings: [{ index: 0, suggestions: ['anther', 'another'] }]
      })
    })
  })

  describe('when multiple words are submitted', () => {
    beforeEach(async () => {
      response = await checkWord(['anather', 'anather', 'theorie'])
    })

    it('should return the misspellings for all the words', async () => {
      const body = JSON.parse(response.body)
      expect(body.misspellings.length).to.equal(3)
    })

    it('should have misspelling suggestions with consecutive indexes', async () => {
      const body = JSON.parse(response.body)
      const indexes = body.misspellings.map(mspl => mspl.index)
      expect(indexes).to.deep.equal([0, 1, 2])
    })

    it('should return identical suggestions for the same entry', async () => {
      const body = JSON.parse(response.body)
      expect(body.misspellings[0].suggestions).to.deep.equal(
        body.misspellings[1].suggestions
      )
    })
  })

  describe('when a very long list of words if submitted', () => {
    beforeEach(async () => {
      let words = []
      for (let i = 0; i <= 20000; i++) {
        words.push('anather')
      }
      response = await checkWord(words)
    })

    it('should return misspellings for the first 10K results only', async () => {
      const body = JSON.parse(response.body)
      expect(body.misspellings.length).to.equal(10000)
    })

    it('should have misspelling suggestions with consecutive indexes', async () => {
      const body = JSON.parse(response.body)
      const indexList = body.misspellings.map(mspl => mspl.index)
      expect(indexList.length).to.equal(10000) // avoid testing over an incorrect array
      for (let i = 0; i < indexList.length - 1; i++) {
        expect(indexList[i] + 1).to.equal(indexList[i + 1])
      }
    })
  })

  describe('when a very long list of words with utf8 responses', () => {
    beforeEach(async () => {
      let words = []
      for (let i = 0; i <= 20000; i++) {
        words.push('anéther')
      }
      response = await checkWord(words, 'bg') // use Bulgarian to generate utf8 response
    })

    it('should return misspellings for the first 10K results only', async () => {
      const body = JSON.parse(response.body)
      expect(body.misspellings.length).to.equal(10000)
    })

    it('should have misspelling suggestions with consecutive indexes', async () => {
      const body = JSON.parse(response.body)
      const indexList = body.misspellings.map(mspl => mspl.index)
      expect(indexList.length).to.equal(10000) // avoid testing over an incorrect array
      for (let i = 0; i < indexList.length - 1; i++) {
        expect(indexList[i] + 1).to.equal(indexList[i + 1])
      }
    })
  })

  describe('when multiple words with utf8 are submitted', () => {
    beforeEach(async () => {
      response = await checkWord(['mneá', 'meniésn', 'meônoi', 'mneá'], 'pt_BR')
    })

    it('should return the misspellings for all the words', async () => {
      const body = JSON.parse(response.body)
      expect(body.misspellings.length).to.equal(4)
    })

    it('should have misspelling suggestions with consecutive indexes', async () => {
      const body = JSON.parse(response.body)
      const indexes = body.misspellings.map(mspl => mspl.index)
      expect(indexes).to.deep.equal([0, 1, 2, 3])
    })

    it('should return identical suggestions for the same entry', async () => {
      const body = JSON.parse(response.body)
      expect(body.misspellings[0].suggestions).to.deep.equal(
        body.misspellings[3].suggestions
      )
    })
  })
})

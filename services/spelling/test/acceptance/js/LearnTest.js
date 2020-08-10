const { expect } = require('chai')
const request = require('./helpers/request')

const USER_ID = 101

const checkWord = (words) =>
  request.post({
    url: `/user/${USER_ID}/check`,
    body: JSON.stringify({
      words
    })
  })

const learnWord = (word) =>
  request.post({
    url: `/user/${USER_ID}/learn`,
    body: JSON.stringify({
      word
    })
  })

const unlearnWord = (word) =>
  request.post({
    url: `/user/${USER_ID}/unlearn`,
    body: JSON.stringify({
      word
    })
  })

const getDict = () =>
  request.get({
    url: `/user/${USER_ID}`
  })

const deleteDict = () =>
  request.del({
    url: `/user/${USER_ID}`
  })

describe('learning words', function () {
  afterEach(async function () {
    await deleteDict()
  })

  it('should return status 204 when posting a word successfully', async function () {
    const response = await learnWord('abcd')
    expect(response.statusCode).to.equal(204)
  })

  it('should not learn the same word twice', async function () {
    await learnWord('foobar')
    const learnResponse = await learnWord('foobar')
    expect(learnResponse.statusCode).to.equal(204)

    const dictResponse = await getDict()
    const responseBody = JSON.parse(dictResponse.body)
    // the response from getlearnedwords filters out duplicates, so this test
    // can succeed even if the word is stored twice in the database
    expect(responseBody.length).to.equals(1)
  })

  it('should return no misspellings after a word is learnt', async function () {
    const response = await checkWord(['abv'])
    const responseBody = JSON.parse(response.body)
    expect(responseBody.misspellings.length).to.equals(1)

    await learnWord('abv')

    const response2 = await checkWord(['abv'])
    const responseBody2 = JSON.parse(response2.body)
    expect(responseBody2.misspellings.length).to.equals(0)
  })

  it('should return misspellings again after a personal dictionary is deleted', async function () {
    await learnWord('bvc')
    await deleteDict()

    const response = await checkWord(['bvc'])
    const responseBody = JSON.parse(response.body)
    expect(responseBody.misspellings.length).to.equals(1)
  })
})

describe('unlearning words', function () {
  it('should return status 204 when posting a word successfully', async function () {
    const response = await unlearnWord('anything')
    expect(response.statusCode).to.equal(204)
  })

  it('should return misspellings after a word is unlearnt', async function () {
    await learnWord('abv')

    const response = await checkWord(['abv'])
    const responseBody = JSON.parse(response.body)
    expect(responseBody.misspellings.length).to.equals(0)

    await unlearnWord('abv')

    const response2 = await checkWord(['abv'])
    const responseBody2 = JSON.parse(response2.body)
    expect(responseBody2.misspellings.length).to.equals(1)
  })
})

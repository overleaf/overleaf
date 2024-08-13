const { expect } = require('chai')
const fs = require('fs')
const Path = require('path')
const fetch = require('node-fetch')
const UserHelper = require('./helpers/UserHelper')
const BASE_URL = UserHelper.baseUrl()

const CRASH_TEST_URLS = fs
  .readFileSync(Path.join(__dirname, '../files/crash_test_urls.txt'))
  .toString()
  .split('\n')

describe('Server Crash Tests', function () {
  it(`should not crash on bad urls`, async function () {
    // increase the timeout for this test due to the number of urls
    this.timeout(60 * 1000)
    // test each url in the list
    for (let i = 0; i < CRASH_TEST_URLS.length; i++) {
      const url = BASE_URL + CRASH_TEST_URLS[i]
      const response = await fetch(url)
      expect(response.status).to.not.match(
        /5\d\d/,
        `Request to ${url} failed with status ${response.status}`
      )
    }
  })
})

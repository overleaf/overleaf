const { expect } = require('chai')
const fs = require('fs')
const Path = require('path')
const fetch = require('node-fetch')
const UserHelper = require('./helpers/UserHelper')
const BASE_URL = UserHelper.baseUrl()
const glob = require('glob')

// Test all files in the crash_test_urls directory
const CRASH_TEST_FILES = glob.sync(
  Path.join(__dirname, '../files/crash_test_urls/*.txt')
)

describe('Server Crash Tests', function () {
  for (const file of CRASH_TEST_FILES) {
    const crashTestUrls = fs.readFileSync(file).toString().split('\n')
    it(`should not crash on bad urls in ${file}`, async function () {
      // increase the timeout for these tests due to the number of urls
      this.timeout(60 * 1000)
      // test each url in the list
      for (let i = 0; i < crashTestUrls.length; i++) {
        const url = BASE_URL + crashTestUrls[i]
        const response = await fetch(url)
        expect(response.status).to.not.match(
          /5\d\d/,
          `Request to ${url} failed with status ${response.status}`
        )
      }
    })
  }
})

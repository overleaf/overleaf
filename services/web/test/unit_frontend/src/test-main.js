/* eslint-disable
    no-undef,
    max-len,
*/
// Set up requirejs to load the tests and mocked dependencies
// For tests, uses heuristic that test filenames end with Tests.js (existing
// frontend code) or _tests.js (newer frontend code)
// For mocks, uses heuristic that loads any .js file within the mocks subfolder
const testDeps = []
for (let file in window.__karma__.files) {
  if (window.__karma__.files.hasOwnProperty(file)) {
    if (
      /test\/unit_frontend\/js.+(_t|T)ests\.js$/.test(file) ||
      /test\/unit_frontend\/js\/mocks\/.+\.js$/.test(file)
    ) {
      testDeps.push(file)
    }
  }
}

requirejs.config({
  baseUrl: '/base/public/js',
  paths: {
    moment: 'libs/moment-2.9.0'
  },
  map: {
    '*': {
      'ide/file-tree/util/fileOperationI18nNames':
        '../../test/unit_frontend/js/mocks/ide/file-tree/util/fileOperationI18nNames'
    }
  },
  deps: testDeps,
  callback: window.__karma__.start
})

import AbstractMockApi from './AbstractMockApi.mjs'
import { plainTextResponse } from '../../../../app/src/infrastructure/Response.mjs'

class MockHaveIBeenPwnedApi extends AbstractMockApi {
  reset() {
    this.seenPasswords = {}
  }

  addPasswordByHash(hash) {
    this.seenPasswords[hash] |= 0
    this.seenPasswords[hash]++
  }

  getPasswordsByRange(prefix) {
    if (prefix.length !== 5) {
      throw new Error('prefix must be of length 5')
    }
    const matches = [
      // padding
      '274CCEF6AB4DFAAF86599792FA9C3FE4689:42',
      '29780E39FF6511C0FC227744B2817D122F4:1337',
    ]
    for (const [hash, score] of Object.entries(this.seenPasswords)) {
      if (hash.startsWith(prefix)) {
        matches.push(hash.slice(5) + ':' + score)
      }
    }
    return matches.join('\r\n')
  }

  applyRoutes() {
    this.app.get('/range/:prefix', (req, res) => {
      const { prefix } = req.params
      if (prefix === 'C8893') {
        plainTextResponse(res, '74D74EFD7B158D2ADD283D67FF3E53B55D7:broken')
      } else {
        plainTextResponse(res, this.getPasswordsByRange(prefix))
      }
    })
  }
}

export default MockHaveIBeenPwnedApi

// type hint for the inherited `instance` method
/**
 * @function instance
 * @memberOf MockHaveIBeenPwnedApi
 * @static
 * @returns {MockHaveIBeenPwnedApi}
 */

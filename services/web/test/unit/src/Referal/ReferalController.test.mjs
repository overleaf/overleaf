import esmock from 'esmock'
const modulePath = new URL(
  '../../../../app/src/Features/Referal/ReferalController.js',
  import.meta.url
).pathname

describe('Referal controller', function () {
  beforeEach(async function () {
    this.controller = await esmock.strict(modulePath, {})
  })
})

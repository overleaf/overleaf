const modulePath = '../../../../app/src/Features/Referal/ReferalController.js'

describe.skip('Referal controller', function () {
  beforeEach(async function (ctx) {
    ctx.controller = (await import(modulePath)).default
  })
})

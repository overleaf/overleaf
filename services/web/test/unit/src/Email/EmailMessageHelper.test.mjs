import path from 'node:path'
import { expect } from 'vitest'

const MODULE_PATH = path.join(
  import.meta.dirname,
  '../../../../app/src/Features/Email/EmailMessageHelper'
)

describe('EmailMessageHelper', function () {
  beforeEach(async function (ctx) {
    ctx.EmailMessageHelper = (await import(MODULE_PATH)).default
  })
  describe('cleanHTML', function () {
    beforeEach(function (ctx) {
      ctx.text = 'a message'
      ctx.span = `<span style="text-align:center">${ctx.text}</span>`
      ctx.fullMessage = `${ctx.span}<div></div>`
    })
    it('should remove HTML for plainText version', function (ctx) {
      const processed = ctx.EmailMessageHelper.cleanHTML(ctx.fullMessage, true)
      expect(processed).to.equal(ctx.text)
    })
    it('should keep HTML for HTML version but remove tags not allowed', function (ctx) {
      const processed = ctx.EmailMessageHelper.cleanHTML(ctx.fullMessage, false)
      expect(processed).to.equal(ctx.span)
    })
  })
})

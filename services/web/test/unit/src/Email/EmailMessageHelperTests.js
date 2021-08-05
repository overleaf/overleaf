const SandboxedModule = require('sandboxed-module')
const path = require('path')
const { expect } = require('chai')

const MODULE_PATH = path.join(
  __dirname,
  '../../../../app/src/Features/Email/EmailMessageHelper'
)

describe('EmailMessageHelper', function () {
  beforeEach(function () {
    this.EmailMessageHelper = SandboxedModule.require(MODULE_PATH, {})
  })
  describe('cleanHTML', function () {
    beforeEach(function () {
      this.text = 'a message'
      this.span = `<span style="text-align:center">${this.text}</span>`
      this.fullMessage = `${this.span}<div></div>`
    })
    it('should remove HTML for plainText version', function () {
      const processed = this.EmailMessageHelper.cleanHTML(
        this.fullMessage,
        true
      )
      expect(processed).to.equal(this.text)
    })
    it('should keep HTML for HTML version but remove tags not allowed', function () {
      const processed = this.EmailMessageHelper.cleanHTML(
        this.fullMessage,
        false
      )
      expect(processed).to.equal(this.span)
    })
  })
})

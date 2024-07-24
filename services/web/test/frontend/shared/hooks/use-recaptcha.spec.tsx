import '../../helpers/bootstrap-3'
import { useRecaptcha } from '@/shared/hooks/use-recaptcha'
import * as ReactGoogleRecaptcha from 'react-google-recaptcha'

const ReCaptcha = () => {
  const { ref: recaptchaRef, getReCaptchaToken } = useRecaptcha()

  const handleClick = async () => {
    await getReCaptchaToken()
  }

  return (
    <>
      <ReactGoogleRecaptcha.ReCAPTCHA
        ref={recaptchaRef}
        size="invisible"
        sitekey="123456"
        badge="inline"
      />
      <button onClick={handleClick}>Click</button>
    </>
  )
}

describe('useRecaptcha', function () {
  it('should reset the captcha', function () {
    cy.spy(ReactGoogleRecaptcha.ReCAPTCHA.prototype, 'reset').as('resetSpy')
    cy.spy(ReactGoogleRecaptcha.ReCAPTCHA.prototype, 'executeAsync').as(
      'executeAsyncSpy'
    )

    cy.mount(<ReCaptcha />)

    cy.findByRole('button', { name: /click/i }).click()
    cy.get('@resetSpy').should('have.been.calledOnce')
    cy.get('@executeAsyncSpy').should('have.been.calledOnce')
  })
})

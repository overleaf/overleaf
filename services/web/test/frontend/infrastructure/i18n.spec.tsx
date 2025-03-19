import { Trans, useTranslation } from 'react-i18next'

describe('i18n', function () {
  describe('t', function () {
    it('translates a plain string', function () {
      const Test = () => {
        const { t } = useTranslation()
        return <div>{t('accept_change')}</div>
      }
      cy.mount(<Test />)
      cy.findByText('Accept change')
    })

    it('uses defaultValues', function () {
      const Test = () => {
        const { t } = useTranslation()
        return <div>{t('welcome_to_sl')}</div>
      }
      cy.mount(<Test />)
      cy.findByText('Welcome to Overleaf')
    })

    it('uses values', function () {
      const Test = () => {
        const { t } = useTranslation()
        return <div>{t('sort_by_x', { x: 'name' })}</div>
      }
      cy.mount(<Test />)
      cy.findByText('Sort by name')
    })
  })

  describe('Trans', function () {
    it('uses values', function () {
      const Test = () => {
        return (
          <div>
            <Trans
              i18nKey="sort_by_x"
              values={{ x: 'name' }}
              shouldUnescape
              tOptions={{ interpolation: { escapeValue: true } }}
            />
          </div>
        )
      }
      cy.mount(<Test />)
      cy.findByText('Sort by name')
    })

    it('uses an object of components', function () {
      const Test = () => {
        return (
          <div data-testid="container">
            <Trans
              i18nKey="in_order_to_match_institutional_metadata_associated"
              components={{ b: <b /> }}
              values={{ email: 'test@example.com' }}
              shouldUnescape
              tOptions={{ interpolation: { escapeValue: true } }}
            />
          </div>
        )
      }
      cy.mount(<Test />)
      cy.findByTestId('container')
        .should(
          'have.text',
          'In order to match your institutional metadata, your account is associated with the email test@example.com.'
        )
        .find('b')
        .should('have.length', 1)
        .should('have.text', 'test@example.com')
    })

    it('uses an array of components', function () {
      const Test = () => {
        return (
          <div data-testid="container">
            <Trans
              i18nKey="are_you_still_at"
              components={[<b />]} // eslint-disable-line react/jsx-key
              values={{ institutionName: 'Test' }}
              shouldUnescape
              tOptions={{ interpolation: { escapeValue: true } }}
            />
          </div>
        )
      }
      cy.mount(<Test />)
      cy.findByTestId('container')
        .should('have.text', 'Are you still at Test?')
        .find('b')
        .should('have.length', 1)
        .should('have.text', 'Test')
    })

    it('escapes special characters', function () {
      const Test = () => {
        return (
          <div data-testid="container">
            <Trans
              i18nKey="are_you_still_at"
              components={[<b />]} // eslint-disable-line react/jsx-key
              values={{ institutionName: "T&e's<code>t</code>ing" }}
              shouldUnescape
              tOptions={{ interpolation: { escapeValue: true } }}
            />
          </div>
        )
      }
      cy.mount(<Test />)
      cy.findByTestId('container')
        .should('have.text', "Are you still at T&e's<code>t</code>ing?")
        .find('b')
        .should('have.length', 1)
        .should('have.text', "T&e's<code>t</code>ing")
    })

    it('does not convert markup in values to components', function () {
      const Test = () => {
        return (
          <div data-testid="container">
            <Trans
              i18nKey="are_you_still_at"
              components={[<b />]} // eslint-disable-line react/jsx-key
              values={{
                institutionName: "<i>T</i>&<b>e</b>'s<code>t</code>ing",
              }}
              shouldUnescape
              tOptions={{ interpolation: { escapeValue: true } }}
            />
          </div>
        )
      }
      cy.mount(<Test />)
      cy.findByTestId('container')
        .should(
          'have.text',
          "Are you still at <i>T</i>&<b>e</b>'s<code>t</code>ing?"
        )
        .find('b')
        .should('have.length', 1)
        .should('have.text', "<i>T</i>&<b>e</b>'s<code>t</code>ing")
    })
  })
})

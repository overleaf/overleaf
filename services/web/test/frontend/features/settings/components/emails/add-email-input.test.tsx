import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect } from 'chai'
import sinon from 'sinon'
import fetchMock from 'fetch-mock'
import Input, {
  clearDomainCache,
} from '../../../../../../frontend/js/features/settings/components/emails/add-email/input'
import domainBlocklist from '../../../../../../frontend/js/features/settings/domain-blocklist'

const testInstitutionData = [
  { university: { id: 124 }, hostname: 'domain.edu' },
]

describe('<AddEmailInput/>', function () {
  const defaultProps = {
    onChange: () => {},
    handleAddNewEmail: () => {},
  }

  beforeEach(function () {
    clearDomainCache()
    fetchMock.removeRoutes().clearHistory()
  })

  describe('on initial render', function () {
    it('should render an initial input', function () {
      render(<Input {...defaultProps} />)
      screen.getByTestId('affiliations-email')
    })

    it('should not dispatch any `change` event', function () {
      const onChangeStub = sinon.stub()
      render(<Input {...defaultProps} onChange={onChangeStub} />)
      expect(onChangeStub.called).to.equal(false)
    })
  })

  describe('when typing text that does not contain any potential domain match', function () {
    let onChangeStub: sinon.SinonStub
    let handleAddNewEmailStub: sinon.SinonStub

    beforeEach(function () {
      fetchMock.get('express:/institutions/domains', 200)
      onChangeStub = sinon.stub()
      handleAddNewEmailStub = sinon.stub()
      render(
        <Input
          {...defaultProps}
          onChange={onChangeStub}
          handleAddNewEmail={handleAddNewEmailStub}
        />
      )
      fireEvent.change(screen.getByTestId('affiliations-email'), {
        target: { value: 'user' },
      })
    })

    it('should render the text being typed', function () {
      const input = screen.getByTestId('affiliations-email') as HTMLInputElement
      expect(input.value).to.equal('user')
    })

    it('should dispatch a `change` event on every stroke', function () {
      expect(onChangeStub.calledWith('user')).to.equal(true)
      fireEvent.change(screen.getByTestId('affiliations-email'), {
        target: { value: 's' },
      })
      expect(onChangeStub.calledWith('s')).to.equal(true)
    })

    it('should not make any request for institution domains', function () {
      expect(fetchMock.callHistory.called()).to.be.false
    })

    it('should submit on Enter if email looks valid', async function () {
      fireEvent.change(screen.getByTestId('affiliations-email'), {
        target: { value: 'user@domain.com' },
      })
      fireEvent.keyDown(screen.getByTestId('affiliations-email'), {
        key: 'Enter',
      })
      expect(handleAddNewEmailStub.calledWith()).to.equal(true)
    })

    it('should not submit on Enter if email does not look valid', async function () {
      fireEvent.change(screen.getByTestId('affiliations-email'), {
        target: { value: 'user@' },
      })
      fireEvent.keyDown(screen.getByTestId('affiliations-email'), {
        key: 'Enter',
      })
      expect(handleAddNewEmailStub.calledWith()).to.equal(false)
    })
  })

  describe('when typing text that contains a potential domain match', function () {
    let onChangeStub: sinon.SinonStub

    beforeEach(function () {
      onChangeStub = sinon.stub()
      render(<Input {...defaultProps} onChange={onChangeStub} />)
    })

    describe('when there are no matches', function () {
      beforeEach(function () {
        fetchMock.get('express:/institutions/domains', 200)
        fireEvent.change(screen.getByTestId('affiliations-email'), {
          target: { value: 'user@d' },
        })
      })

      it('should render the text being typed', function () {
        const input = screen.getByTestId(
          'affiliations-email'
        ) as HTMLInputElement
        expect(input.value).to.equal('user@d')
      })
    })

    describe('when there is a domain match', function () {
      beforeEach(async function () {
        fetchMock.get('express:/institutions/domains', testInstitutionData)
        const input = await screen.findByTestId('affiliations-email')
        fireEvent.change(input, { target: { value: 'user@d' } })

        // Wait for the request to complete and the domain cache to pouplate
        await waitFor(
          () =>
            expect(
              fetchMock.callHistory.called('express:/institutions/domains')
            ).to.be.true
        )
        // Wait for component to process the change and update the shadow input
        await waitFor(() => {
          const shadowInput = screen.getByTestId(
            'affiliations-email-shadow'
          ) as HTMLInputElement
          expect(shadowInput.value).to.equal('user@domain.edu')
        })
      })

      it('should render the text being typed along with the suggestion', async function () {
        const input = screen.getByTestId(
          'affiliations-email'
        ) as HTMLInputElement
        expect(input.value).to.equal('user@d')
        await waitFor(() => {
          const shadowInput = screen.getByTestId(
            'affiliations-email-shadow'
          ) as HTMLInputElement
          expect(shadowInput.value).to.equal('user@domain.edu')
        })
      })

      it('should dispatch a `change` event with the typed text', function () {
        expect(onChangeStub.calledWith('user@d')).to.equal(true)
      })

      it('should dispatch a `change` event with institution data when the typed email contains the institution domain', async function () {
        fireEvent.change(screen.getByTestId('affiliations-email'), {
          target: { value: 'user@domain.edu' },
        })
        await fetchMock.callHistory.flush(true)
        expect(
          onChangeStub.calledWith(
            'user@domain.edu',
            sinon.match(testInstitutionData[0])
          )
        ).to.equal(true)
      })

      it('should clear the suggestion when the potential domain match is completely deleted', async function () {
        await waitFor(() => {
          const shadowInput = screen.getByTestId(
            'affiliations-email-shadow'
          ) as HTMLInputElement
          expect(shadowInput.value).to.equal('user@domain.edu')
        })
        fireEvent.change(screen.getByTestId('affiliations-email'), {
          target: { value: '' },
        })
        expect(screen.queryByText('user@domain.edu')).to.be.null
      })

      describe('when there is a suggestion and "Tab" key is pressed', function () {
        beforeEach(async function () {
          // wait until autocompletion available
          await waitFor(() => {
            const shadowInput = screen.getByTestId(
              'affiliations-email-shadow'
            ) as HTMLInputElement
            expect(shadowInput.value).to.equal('user@domain.edu')
          })
          fireEvent.keyDown(screen.getByTestId('affiliations-email'), {
            key: 'Tab',
          })
        })

        it('it should autocomplete the input', async function () {
          const input = screen.getByTestId(
            'affiliations-email'
          ) as HTMLInputElement
          expect(input.value).to.equal('user@domain.edu')
        })

        it('should dispatch a `change` event with the domain matched', async function () {
          expect(
            onChangeStub.calledWith(
              'user@domain.edu',
              sinon.match(testInstitutionData[0])
            )
          ).to.equal(true)
        })
      })

      describe('when there is a suggestion and "Enter" key is pressed', function () {
        beforeEach(async function () {
          // wait until autocompletion available
          await waitFor(() => {
            const shadowInput = screen.getByTestId(
              'affiliations-email-shadow'
            ) as HTMLInputElement
            expect(shadowInput.value).to.equal('user@domain.edu')
          })
          fireEvent.keyDown(screen.getByTestId('affiliations-email'), {
            key: 'Enter',
          })
        })

        it('it should autocomplete the input', async function () {
          const input = screen.getByTestId(
            'affiliations-email'
          ) as HTMLInputElement
          expect(input.value).to.equal('user@domain.edu')
        })

        it('should dispatch a `change` event with the domain matched', async function () {
          expect(
            onChangeStub.calledWith(
              'user@domain.edu',
              sinon.match(testInstitutionData[0])
            )
          ).to.equal(true)
        })
      })

      it('should cache the result and skip subsequent requests', async function () {
        fetchMock.removeRoutes().clearHistory()

        // clear input
        fireEvent.change(screen.getByTestId('affiliations-email'), {
          target: { value: '' },
        })
        // type a hint to trigger the domain search
        fireEvent.change(screen.getByTestId('affiliations-email'), {
          target: { value: 'user@d' },
        })

        expect(fetchMock.callHistory.called()).to.be.false
        expect(onChangeStub.calledWith('user@d')).to.equal(true)
        await waitFor(() => {
          const shadowInput = screen.getByTestId(
            'affiliations-email-shadow'
          ) as HTMLInputElement
          expect(shadowInput.value).to.equal('user@domain.edu')
        })
      })
    })

    describe('when there is a match for a blocklisted domain', function () {
      const [blockedDomain] = domainBlocklist

      afterEach(function () {
        clearDomainCache()
        fetchMock.removeRoutes().clearHistory()
      })

      it('should not render the suggestion with blocked domain', async function () {
        const blockedInstitution = [
          { university: { id: 1 }, hostname: blockedDomain },
        ]
        fetchMock.get('express:/institutions/domains', blockedInstitution)
        fireEvent.change(screen.getByTestId('affiliations-email'), {
          target: { value: `user@${blockedDomain.split('.')[0]}` },
        })
        await fetchMock.callHistory.flush(true)
        expect(screen.queryByText(`user@${blockedDomain}`)).to.be.null
      })

      it('should not render the suggestion with blocked domain having a subdomain', async function () {
        const blockedInstitution = [
          {
            university: { id: 1 },
            hostname: `subdomain.${blockedDomain}`,
          },
        ]
        fetchMock.get('express:/institutions/domains', blockedInstitution)
        fireEvent.change(screen.getByTestId('affiliations-email'), {
          target: {
            value: `user@subdomain.${blockedDomain.split('.')[0]}`,
          },
        })
        await fetchMock.callHistory.flush(true)
        expect(screen.queryByText(`user@subdomain.${blockedDomain}`)).to.be.null
      })
    })

    describe('while waiting for a response', function () {
      beforeEach(async function () {
        // type an initial suggestion
        fetchMock.get('express:/institutions/domains', testInstitutionData)
        fireEvent.change(screen.getByTestId('affiliations-email'), {
          target: { value: 'user@d' },
        })
        await waitFor(() => {
          const shadowInput = screen.getByTestId(
            'affiliations-email-shadow'
          ) as HTMLInputElement
          expect(shadowInput.value).to.equal('user@domain.edu')
        })

        // make sure the next suggestions are delayed
        clearDomainCache()
        fetchMock.removeRoutes().clearHistory()
        fetchMock.get('express:/institutions/domains', 200, { delay: 1000 })
      })

      it('should keep the suggestion if the hint matches the previously matched domain', async function () {
        fireEvent.change(screen.getByTestId('affiliations-email'), {
          target: { value: 'user@do' },
        })
        const shadowInput = screen.getByTestId(
          'affiliations-email-shadow'
        ) as HTMLInputElement
        expect(shadowInput.value).to.equal('user@domain.edu')
      })

      it('should remove the suggestion if the hint does not match the previously matched domain', async function () {
        fireEvent.change(screen.getByTestId('affiliations-email'), {
          target: { value: 'user@foo' },
        })
        await waitFor(() => {
          const shadowInput = screen.getByTestId(
            'affiliations-email-shadow'
          ) as HTMLInputElement
          expect(shadowInput.value).to.equal('')
        })
      })
    })
  })

  describe('when the request to fetch institution domains fail', function () {
    let onChangeStub

    beforeEach(async function () {
      // initial request populates the suggestion
      fetchMock.get('express:/institutions/domains', testInstitutionData)
      onChangeStub = sinon.stub()
      render(<Input {...defaultProps} onChange={onChangeStub} />)
      fireEvent.change(screen.getByTestId('affiliations-email'), {
        target: { value: 'user@d' },
      })
      await waitFor(() => {
        const shadowInput = screen.getByTestId(
          'affiliations-email-shadow'
        ) as HTMLInputElement
        expect(shadowInput.value).to.equal('user@domain.edu')
      })

      // subsequent requests fail
      fetchMock.removeRoutes().clearHistory()
      fetchMock.get('express:/institutions/domains', 500)
    })

    it('should clear suggestions', async function () {
      fireEvent.change(screen.getByTestId('affiliations-email'), {
        target: { value: 'user@dom' },
      })

      const input = screen.getByTestId('affiliations-email') as HTMLInputElement
      expect(input.value).to.equal('user@dom')

      await waitFor(() => {
        const shadowInput = screen.getByTestId(
          'affiliations-email-shadow'
        ) as HTMLInputElement
        expect(shadowInput.value).to.equal('')
      })

      expect(fetchMock.callHistory.called()).to.be.true // ensures `domainCache` hasn't been hit
    })
  })

  describe('when the request to fetch institution is not matching input', function () {
    it('should clear suggestion', async function () {
      fetchMock.get('express:/institutions/domains', testInstitutionData)
      render(<Input {...defaultProps} onChange={sinon.stub()} />)
      fireEvent.change(screen.getByTestId('affiliations-email'), {
        target: { value: 'user@other' },
      })
      await fetchMock.callHistory.flush(true)
      const shadowInput = screen.getByTestId(
        'affiliations-email-shadow'
      ) as HTMLInputElement
      expect(shadowInput.value).to.equal('')
    })
  })
})

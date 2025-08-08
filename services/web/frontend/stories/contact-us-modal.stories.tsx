import { ComponentProps, useCallback, useState } from 'react'
import useFetchMock from './hooks/use-fetch-mock'
import ContactUsModal from '../../modules/support/frontend/js/components/contact-us-modal'
import fixedHelpSuggestionSearch from '../../modules/support/test/frontend/util/fixed-help-suggestion-search'
import { ScopeDecorator } from './decorators/scope'
import OLButton from '@/shared/components/ol/ol-button'

type ContactUsModalProps = ComponentProps<typeof ContactUsModal>

function GenericContactUsModal(args: ContactUsModalProps) {
  useFetchMock(fetchMock => {
    fetchMock.post('/support', { status: 200 }, { delay: 1000 })
  })

  return (
    <ContactUsModal
      helpSuggestionSearch={fixedHelpSuggestionSearch}
      {...args}
    />
  )
}

export const Generic = (args: ContactUsModalProps) => (
  <GenericContactUsModal {...args} />
)

const ContactUsModalWithRequestError = (args: ContactUsModalProps) => {
  useFetchMock(fetchMock => {
    fetchMock.post('/support', { status: 404 }, { delay: 250 })
  })

  return (
    <ContactUsModal
      helpSuggestionSearch={fixedHelpSuggestionSearch}
      {...args}
    />
  )
}

export const RequestError = (args: ContactUsModalProps) => (
  <ContactUsModalWithRequestError {...args} />
)

const ContactUsModalWithAcknowledgement = (
  args: Omit<ContactUsModalProps, 'show' | 'handleHide'>
) => {
  useFetchMock(fetchMock => {
    fetchMock.post('/support', { status: 200 }, { delay: 1000 })
  })

  const [show, setShow] = useState(false)

  const hideModal = useCallback((event?: Event) => {
    event?.preventDefault()
    setShow(false)
  }, [])

  return (
    <>
      <OLButton onClick={() => setShow(true)}>Contact Us</OLButton>
      <ContactUsModal
        show={show}
        handleHide={hideModal}
        helpSuggestionSearch={fixedHelpSuggestionSearch}
        {...args}
      />
    </>
  )
}

export const WithAcknowledgement = (args: ContactUsModalProps) => {
  const { show: _show, handleHide: _handleHide, ...rest } = args
  return <ContactUsModalWithAcknowledgement {...rest} />
}

export default {
  title: 'Shared / Modals / Contact Us',
  component: ContactUsModal,
  args: {
    show: true,
    handleHide: () => {},
    autofillProjectUrl: true,
  },
  argTypes: {
    handleHide: { action: 'close modal' },
  },
  decorators: [ScopeDecorator],
}

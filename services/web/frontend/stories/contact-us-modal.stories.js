import { useState } from 'react'
import useFetchMock from './hooks/use-fetch-mock'
import ContactUsModal from '../../modules/support/frontend/js/components/contact-us-modal'
import { ScopeDecorator } from './decorators/scope'

export const Generic = () => {
  const [show, setShow] = useState(true)

  const handleHide = () => setShow(false)

  useFetchMock(fetchMock => {
    fetchMock.post('/support', { status: 200 }, { delay: 1000 })
  })

  return <ContactUsModal show={show} handleHide={handleHide} />
}

export const RequestError = args => {
  useFetchMock(fetchMock => {
    fetchMock.post('/support', { status: 404 }, { delay: 250 })
  })

  return <ContactUsModal {...args} />
}

export default {
  title: 'Shared / Modals / Contact Us',
  component: ContactUsModal,
  args: {
    show: true,
    handleHide: () => {},
  },
  argTypes: {
    handleHide: { action: 'close modal' },
  },
  decorators: [ScopeDecorator],
}

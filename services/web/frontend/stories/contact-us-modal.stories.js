import { useState } from 'react'
import useFetchMock from './hooks/use-fetch-mock'
import ContactUsModal from '../../modules/support/frontend/js/components/contact-us-modal'
import { withContextRoot } from './utils/with-context-root'

export const Generic = () => {
  const [show, setShow] = useState(true)
  const handleHide = () => setShow(false)

  useFetchMock(fetchMock => {
    fetchMock.post('express:/support', { status: 200 }, { delay: 1000 })
  })

  return withContextRoot(<ContactUsModal show={show} handleHide={handleHide} />)
}

export const RequestError = args => {
  useFetchMock(fetchMock => {
    fetchMock.post('express:/support', { status: 404 }, { delay: 250 })
  })

  return withContextRoot(<ContactUsModal {...args} />)
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
}

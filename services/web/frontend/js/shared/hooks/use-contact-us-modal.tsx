import importOverleafModules from '../../../macros/import-overleaf-module.macro'
import {
  JSXElementConstructor,
  useCallback,
  useState,
  type UIEvent,
} from 'react'

const [contactUsModalModules] = importOverleafModules('contactUsModal')
const ContactUsModal: JSXElementConstructor<{
  show: boolean
  handleHide: () => void
  autofillProjectUrl: boolean
}> = contactUsModalModules?.import.default

export const useContactUsModal = (options = { autofillProjectUrl: true }) => {
  const [show, setShow] = useState(false)

  const hideModal = useCallback((event?: Event) => {
    event?.preventDefault()
    setShow(false)
  }, [])

  const showModal = useCallback((event?: Event | UIEvent) => {
    event?.preventDefault()
    setShow(true)
  }, [])

  const modal = ContactUsModal && (
    <ContactUsModal
      show={show}
      handleHide={hideModal}
      autofillProjectUrl={options.autofillProjectUrl}
    />
  )

  return { modal, hideModal, showModal }
}

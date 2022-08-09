import importOverleafModules from '../../../macros/import-overleaf-module.macro'
import { JSXElementConstructor, useCallback, useState } from 'react'

const [contactUsModalModules] = importOverleafModules('contactUsModal')
const ContactUsModal: JSXElementConstructor<{
  show: boolean
  handleHide: () => void
}> = contactUsModalModules?.import.default

export const useContactUsModal = () => {
  const [show, setShow] = useState(false)

  const hideModal = useCallback((event?: Event) => {
    event?.preventDefault()
    setShow(false)
  }, [])

  const showModal = useCallback((event?: Event) => {
    event?.preventDefault()
    setShow(true)
  }, [])

  const modal = ContactUsModal && (
    <ContactUsModal show={show} handleHide={hideModal} />
  )

  return { modal, hideModal, showModal }
}

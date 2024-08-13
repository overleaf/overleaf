import importOverleafModules from '../../../macros/import-overleaf-module.macro'
import { JSXElementConstructor, useCallback, useState } from 'react'
import { HelpSuggestionSearchProvider } from '../../../../modules/support/frontend/js/context/help-suggestion-search-context'

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

  const showModal = useCallback((event?: Event) => {
    event?.preventDefault()
    setShow(true)
  }, [])

  const modal = ContactUsModal && (
    <HelpSuggestionSearchProvider>
      <ContactUsModal
        show={show}
        handleHide={hideModal}
        autofillProjectUrl={options.autofillProjectUrl}
      />
    </HelpSuggestionSearchProvider>
  )

  return { modal, hideModal, showModal }
}

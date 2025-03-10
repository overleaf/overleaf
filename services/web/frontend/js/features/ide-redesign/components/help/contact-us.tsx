import { FC, JSXElementConstructor, useCallback } from 'react'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'
import { useRailContext } from '../../contexts/rail-context'
import getMeta from '@/utils/meta'

const [contactUsModalModules] = importOverleafModules('contactUsModal')
const ContactUsModal: JSXElementConstructor<{
  show: boolean
  handleHide: () => void
  autofillProjectUrl: boolean
}> = contactUsModalModules?.import.default

export const RailHelpContactUsModal: FC<{ show: boolean }> = ({ show }) => {
  const { setActiveModal } = useRailContext()
  const handleHide = useCallback(() => setActiveModal(null), [setActiveModal])
  if (!ContactUsModal) {
    return null
  }
  const showSupport = getMeta('ol-showSupport')
  if (!showSupport) {
    return null
  }
  return (
    <ContactUsModal show={show} handleHide={handleHide} autofillProjectUrl />
  )
}

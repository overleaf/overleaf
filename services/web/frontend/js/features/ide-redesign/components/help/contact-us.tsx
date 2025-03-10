import { FC, useCallback } from 'react'
import ContactUsModal from '../../../../../../modules/support/frontend/js/components/contact-us-modal'
import { useRailContext } from '../../contexts/rail-context'
import getMeta from '@/utils/meta'

export const RailHelpContactUsModal: FC<{ show: boolean }> = ({ show }) => {
  const { setActiveModal } = useRailContext()
  const handleHide = useCallback(() => setActiveModal(null), [setActiveModal])
  const showSupport = getMeta('ol-showSupport')
  if (!showSupport) {
    return null
  }
  return (
    <ContactUsModal show={show} handleHide={handleHide} autofillProjectUrl />
  )
}

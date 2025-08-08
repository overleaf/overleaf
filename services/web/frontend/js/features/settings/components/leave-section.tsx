import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import LeaveModal from './leave/modal'
import getMeta from '../../../utils/meta'
import OLButton from '@/shared/components/ol/ol-button'

function LeaveSection() {
  const { t } = useTranslation()

  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleClose = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  const handleOpen = useCallback(() => {
    setIsModalOpen(true)
  }, [])

  // Prevent managed users deleting their own accounts
  if (getMeta('ol-cannot-delete-own-account')) {
    return (
      <>
        {t('need_to_leave')} {t('contact_group_admin')}
      </>
    )
  }

  return (
    <>
      {t('need_to_leave')}{' '}
      <OLButton
        className="btn-inline-link"
        variant="danger"
        onClick={handleOpen}
      >
        {t('delete_your_account')}
      </OLButton>
      <LeaveModal isOpen={isModalOpen} handleClose={handleClose} />
    </>
  )
}

export default LeaveSection

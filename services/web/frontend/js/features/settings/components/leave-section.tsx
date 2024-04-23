import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import LeaveModal from './leave/modal'
import getMeta from '../../../utils/meta'
import ButtonWrapper from '@/features/ui/components/bootstrap-5/wrappers/button-wrapper'
import { bsVersion } from '@/features/utils/bootstrap-5'

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
      <ButtonWrapper
        className={bsVersion({
          bs3: 'btn btn-inline-link btn-danger',
          bs5: 'btn-link',
        })}
        variant="danger"
        onClick={handleOpen}
      >
        {t('delete_your_account')}
      </ButtonWrapper>
      <LeaveModal isOpen={isModalOpen} handleClose={handleClose} />
    </>
  )
}

export default LeaveSection

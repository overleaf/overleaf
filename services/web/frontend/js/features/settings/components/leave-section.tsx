import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import LeaveModal from './leave/modal'

function LeaveSection() {
  const { t } = useTranslation()

  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleClose = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  const handleOpen = useCallback(() => {
    setIsModalOpen(true)
  }, [])

  return (
    <>
      {t('need_to_leave')}{' '}
      <button className="btn btn-inline-link btn-danger" onClick={handleOpen}>
        {t('delete_your_account')}
      </button>
      <LeaveModal isOpen={isModalOpen} handleClose={handleClose} />
    </>
  )
}

export default LeaveSection

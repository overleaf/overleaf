import { memo, useCallback, useState } from 'react'
import { MenuItem } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { useProjectListContext } from '../../../../context/project-list-context'
import useIsMounted from '../../../../../../shared/hooks/use-is-mounted'
import RenameProjectModal from '../../../modals/rename-project-modal'

function RenameProjectMenuItem() {
  const { selectedProjects } = useProjectListContext()
  const [showModal, setShowModal] = useState(false)
  const isMounted = useIsMounted()
  const { t } = useTranslation()

  const handleOpenModal = useCallback(() => {
    setShowModal(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    if (isMounted.current) {
      setShowModal(false)
    }
  }, [isMounted])

  if (selectedProjects.length !== 1) return null

  return (
    <>
      <MenuItem onClick={handleOpenModal}>{t('rename')}</MenuItem>
      <RenameProjectModal
        handleCloseModal={handleCloseModal}
        showModal={showModal}
        project={selectedProjects[0]}
      />
    </>
  )
}

export default memo(RenameProjectMenuItem)

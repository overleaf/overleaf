import { Project } from '../../../../../../../../types/project/dashboard/api'
import { useTranslation } from 'react-i18next'
import { memo, useCallback, useState } from 'react'
import useIsMounted from '@/shared/hooks/use-is-mounted'
import RenameProjectModal from '../../../modals/rename-project-modal'

type RenameProjectButtonProps = {
  project: Project
  children: (text: string, handleOpenModal: () => void) => React.ReactElement
}

function RenameProjectButton({ project, children }: RenameProjectButtonProps) {
  const { t } = useTranslation()
  const text = t('rename')
  const [showModal, setShowModal] = useState(false)
  const isMounted = useIsMounted()

  const handleOpenModal = useCallback(() => {
    setShowModal(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    if (isMounted.current) {
      setShowModal(false)
    }
  }, [isMounted])

  if (project.accessLevel !== 'owner') {
    return null
  }
  return (
    <>
      {children(text, handleOpenModal)}
      <RenameProjectModal
        handleCloseModal={handleCloseModal}
        project={project}
        showModal={showModal}
      />
    </>
  )
}

export default memo(RenameProjectButton)

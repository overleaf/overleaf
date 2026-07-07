import EditorCloneProjectModalWrapper from '@/features/clone-project-modal/components/editor-clone-project-modal-wrapper'
import DropdownMenuItem from '@/shared/components/dropdown/dropdown-menu-item'
import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'
import useOpenProject from '@/shared/hooks/use-open-project'
import getMeta from '@/utils/meta'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

export const DuplicateProject = () => {
  const { sendEvent } = useEditorAnalytics()
  const { t } = useTranslation()
  const [showModal, setShowModal] = useState(false)
  const anonymous = getMeta('ol-anonymous')
  const openProject = useOpenProject()

  const handleShowModal = useCallback(() => {
    sendEvent('copy-project', { location: 'project-title-dropdown' })
    setShowModal(true)
  }, [sendEvent])

  if (anonymous) {
    return null
  }

  return (
    <>
      <DropdownMenuItem onClick={handleShowModal}>
        {t('make_a_copy')}
      </DropdownMenuItem>
      <EditorCloneProjectModalWrapper
        show={showModal}
        handleHide={() => setShowModal(false)}
        openProject={openProject}
      />
    </>
  )
}

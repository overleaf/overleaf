import EditorCloneProjectModalWrapper from '@/features/clone-project-modal/components/editor-clone-project-modal-wrapper'
import OLDropdownMenuItem from '@/features/ui/components/ol/ol-dropdown-menu-item'
import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'
import { useLocation } from '@/shared/hooks/use-location'
import getMeta from '@/utils/meta'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

type ProjectCopyResponse = {
  project_id: string
}

export const DuplicateProject = () => {
  const { sendEvent } = useEditorAnalytics()
  const { t } = useTranslation()
  const [showModal, setShowModal] = useState(false)
  const location = useLocation()
  const anonymous = getMeta('ol-anonymous')

  const openProject = useCallback(
    ({ project_id: projectId }: ProjectCopyResponse) => {
      location.assign(`/project/${projectId}`)
    },
    [location]
  )

  const handleShowModal = useCallback(() => {
    sendEvent('copy-project', { location: 'project-title-dropdown' })
    setShowModal(true)
  }, [sendEvent])

  if (anonymous) {
    return null
  }

  return (
    <>
      <OLDropdownMenuItem onClick={handleShowModal}>
        {t('copy')}
      </OLDropdownMenuItem>
      <EditorCloneProjectModalWrapper
        show={showModal}
        handleHide={() => setShowModal(false)}
        openProject={openProject}
      />
    </>
  )
}

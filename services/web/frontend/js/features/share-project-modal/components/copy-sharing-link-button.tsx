import { useTranslation } from 'react-i18next'
import OLButton from '@/shared/components/ol/ol-button'
import { useShareProjectContext } from '@/features/share-project-modal/components/share-project-modal'
import { useProjectContext } from '@/shared/context/project-context'
import { useUserContext } from '@/shared/context/user-context'
import { debugConsole } from '@/utils/debugging'
import getMeta from '@/utils/meta'
import { sendMB } from '@/infrastructure/event-tracking'

export default function CopySharingLinkButton() {
  const { t } = useTranslation()
  const { sharingLinkData, projectAccess, setSuccessActionMessage } =
    useShareProjectContext()
  const { projectId } = useProjectContext()
  const { isAdmin } = useUserContext()

  const isCopyBtnEnabled =
    Boolean(navigator.clipboard?.writeText) &&
    Boolean(sharingLinkData?.token) &&
    (projectAccess?.startsWith('anyoneInXyzWithTheLink') ||
      projectAccess === 'anyoneWithTheLink')

  const handleCopyClick = () => {
    if (!sharingLinkData?.token) {
      return
    }

    const origin = isAdmin
      ? getMeta('ol-ExposedSettings').siteUrl
      : window.location.origin
    const link = `${origin}/project/${projectId}/share#${sharingLinkData.token}`

    navigator.clipboard
      .writeText(link)
      .then(() => {
        setSuccessActionMessage(t('link_copied'))
        sendMB('sharing-link-copied', {
          project_id: projectId,
        })
      })
      .catch(debugConsole.error)
  }

  return (
    <OLButton
      variant="secondary"
      leadingIcon={isCopyBtnEnabled ? 'link' : 'link_off'}
      disabled={!isCopyBtnEnabled}
      onClick={handleCopyClick}
    >
      {t('copy_sharing_link')}
    </OLButton>
  )
}

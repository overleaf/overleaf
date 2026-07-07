import { useTranslation } from 'react-i18next'
import { useProjectContext } from '@/shared/context/project-context'
import { useEditorContext } from '@/shared/context/editor-context'
import OLRow from '@/shared/components/ol/ol-row'
import OLCol from '@/shared/components/ol/ol-col'
import Notification from '@/shared/components/notification'
import { useFeatureFlag } from '@/shared/context/split-test-context'

function SendInvitesNotice() {
  const isSharingUpdatesEnabled = useFeatureFlag('sharing-updates')
  const { project } = useProjectContext()
  const { publicAccessLevel } = project || {}
  const { isPendingEditor } = useEditorContext()
  const { t } = useTranslation()

  let accessLevelText = ''
  if (publicAccessLevel === 'private') {
    accessLevelText = t('to_add_more_collaborators')
  } else if (publicAccessLevel === 'tokenBased') {
    accessLevelText = t('to_change_access_permissions')
  }

  return (
    <div>
      {isPendingEditor && (
        <div className="notification-list">
          <Notification
            isActionBelowContent
            type="info"
            title={t('youve_lost_collaboration_access')}
            content={
              <div>
                <p>{t('this_project_already_has_maximum_collaborators')}</p>
                <p>
                  {t(
                    'please_ask_the_project_owner_to_upgrade_more_collaborators'
                  )}
                </p>
              </div>
            }
          />
        </div>
      )}
      {accessLevelText &&
        (isSharingUpdatesEnabled ? (
          <div className="notification-list">
            <Notification type="info" content={accessLevelText} />
          </div>
        ) : (
          <OLRow className="public-access-level public-access-level-notice">
            <OLCol className="text-center">
              <span>{accessLevelText}</span>
            </OLCol>
          </OLRow>
        ))}
    </div>
  )
}

export default SendInvitesNotice

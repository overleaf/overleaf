import { useTranslation } from 'react-i18next'
import { useProjectContext } from '@/shared/context/project-context'
import Notification from '@/shared/components/notification'
import { PublicAccessLevel } from '../../../../../types/public-access-level'
import { useEditorContext } from '@/shared/context/editor-context'
import OLRow from '@/features/ui/components/ol/ol-row'
import OLCol from '@/features/ui/components/ol/ol-col'

export default function SendInvitesNotice() {
  const { publicAccessLevel } = useProjectContext()
  const { isPendingEditor } = useEditorContext()
  const { t } = useTranslation()

  return (
    <div>
      {isPendingEditor && (
        <Notification
          isActionBelowContent
          type="info"
          title={t('youve_lost_edit_access')}
          content={
            <div>
              <p>{t('this_project_already_has_maximum_editors')}</p>
              <p>{t('please_ask_the_project_owner_to_upgrade_more_editors')}</p>
            </div>
          }
        />
      )}
      <OLRow className="public-access-level public-access-level-notice">
        <OLCol className="text-center">
          <AccessLevel level={publicAccessLevel} />
        </OLCol>
      </OLRow>
    </div>
  )
}

type AccessLevelProps = {
  level: PublicAccessLevel | undefined
}

function AccessLevel({ level }: AccessLevelProps) {
  const { t } = useTranslation()
  switch (level) {
    case 'private':
      return <span>{t('to_add_more_collaborators')}</span>

    case 'tokenBased':
      return <span>{t('to_change_access_permissions')}</span>

    default:
      return <span>''</span>
  }
}

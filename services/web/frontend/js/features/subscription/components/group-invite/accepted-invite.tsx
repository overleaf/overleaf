import getMeta from '@/utils/meta'
import { useTranslation } from 'react-i18next'

export default function AcceptedInvite() {
  const { t } = useTranslation()
  const inviterName = getMeta('ol-inviterName') as string
  const groupSSOActive = getMeta('ol-groupSSOActive') as boolean
  const subscriptionId = getMeta('ol-subscriptionId') as string

  const doneLink = groupSSOActive
    ? `/subscription/${subscriptionId}/sso_enrollment`
    : '/project'

  return (
    <div className="text-center">
      <p>{t('joined_team', { inviterName })}</p>
      <p>
        <a href={doneLink} className="btn btn-primary">
          {t('done')}
        </a>
      </p>
    </div>
  )
}

import { useTranslation } from 'react-i18next'
import Notification from '../../../../../shared/components/notification'
import getMeta from '../../../../../utils/meta'

function GroupSsoSetupSuccess() {
  const { t } = useTranslation()
  const wasSuccess = getMeta('ol-groupSsoSetupSuccess')

  if (!wasSuccess) {
    return null
  }

  return (
    <li className="notification-entry">
      <Notification
        type="success"
        content={t('success_sso_set_up')}
        isDismissible
      />
    </li>
  )
}

export default GroupSsoSetupSuccess

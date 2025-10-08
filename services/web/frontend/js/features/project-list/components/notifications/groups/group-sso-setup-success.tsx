import { useTranslation, Trans } from 'react-i18next'
import Notification from '../../../../../shared/components/notification'
import getMeta from '../../../../../utils/meta'

function GroupSsoSetupSuccess() {
  const { t } = useTranslation()
  const wasSuccess = getMeta('ol-groupSsoSetupSuccess')
  const joinedGroupName = getMeta('ol-joinedGroupName')
  const viaDomainCapture = getMeta('ol-viaDomainCapture')

  if (!wasSuccess) {
    return null
  }

  if (!viaDomainCapture) {
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

  return joinedGroupName ? (
    <li className="notification-entry">
      <Notification
        type="success"
        content={
          <Trans
            i18nKey="success_youve_successfully_joined_group"
            components={[<b />]} // eslint-disable-line react/jsx-key
            values={{ groupName: joinedGroupName }}
            shouldUnescape
            tOptions={{ interpolation: { escapeValue: true } }}
          />
        }
        isDismissible
      />
    </li>
  ) : null
}

export default GroupSsoSetupSuccess

import Notification from '@/shared/components/notification'
import { useTranslation, Trans } from 'react-i18next'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'

const CheckpointCompilesEnabledReminder = () => {
  const { t } = useTranslation()
  if (!isSplitTestEnabled('compile-with-checkpoint')) {
    return null
  }

  const content = (
    <Trans
      i18nKey="incremental_compiles_reusing_last_compile"
      components={[
        <a href="/labs/participate" target="_blank" rel="noreferrer" />, // eslint-disable-line react/jsx-key, jsx-a11y/anchor-has-content
      ]}
    />
  )

  return (
    <div className="notification-list">
      <Notification
        title={t('incremental_compiles_are_on')}
        content={content}
        type="info"
        className="mb-0"
      />
    </div>
  )
}

export default CheckpointCompilesEnabledReminder

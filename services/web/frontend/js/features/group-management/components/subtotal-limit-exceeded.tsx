import { Trans } from 'react-i18next'
import Notification from '@/shared/components/notification'
import Card from '@/features/group-management/components/card'

function SubtotalLimitExceeded() {
  return (
    <Card>
      <div className="notification-list">
        <Notification
          type="error"
          content={
            <Trans
              i18nKey="sorry_there_was_an_issue_upgrading_your_subscription"
              components={[
                // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
                <a href="/contact" rel="noreferrer noopener" />,
              ]}
            />
          }
          className="m-0"
        />
      </div>
    </Card>
  )
}

export default SubtotalLimitExceeded

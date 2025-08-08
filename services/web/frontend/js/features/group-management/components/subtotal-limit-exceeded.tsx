import { Trans } from 'react-i18next'
import OLNotification from '@/shared/components/ol/ol-notification'
import Card from '@/features/group-management/components/card'

function SubtotalLimitExceeded() {
  return (
    <Card>
      <OLNotification
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
    </Card>
  )
}

export default SubtotalLimitExceeded

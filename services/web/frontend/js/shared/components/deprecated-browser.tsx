import { FC } from 'react'
import Notification from '@/shared/components/notification'
import { Trans, useTranslation } from 'react-i18next'
import Bowser from 'bowser'

export const isDeprecatedBrowser = () => {
  const parser = Bowser.getParser(window.navigator.userAgent)
  return parser.satisfies({
    safari: '~15',
  })
}

export const DeprecatedBrowser: FC = () => {
  const { t } = useTranslation()

  return (
    <Notification
      type="warning"
      title={t('support_for_your_browser_is_ending_soon')}
      content={
        <Trans
          i18nKey="to_continue_using_upgrade_or_change_your_browser"
          components={[
            // eslint-disable-next-line jsx-a11y/anchor-has-content,react/jsx-key
            <a href="/learn/how-to/Which_browsers_does_Overleaf_support%3F" />,
          ]}
        />
      }
    />
  )
}

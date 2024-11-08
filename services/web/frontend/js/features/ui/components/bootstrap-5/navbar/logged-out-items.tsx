import { useTranslation } from 'react-i18next'
import NavLinkItem from '@/features/ui/components/bootstrap-5/navbar/nav-link-item'
import { sendMB } from '@/infrastructure/event-tracking'

export default function LoggedOutItems({
  showSignUpLink,
  currentUrl,
}: {
  showSignUpLink: boolean
  currentUrl: string
}) {
  const { t } = useTranslation()

  return (
    <>
      {showSignUpLink ? (
        <NavLinkItem
          href="/register"
          className="primary"
          onClick={e => {
            sendMB('menu-clicked-register', { page: currentUrl })
          }}
        >
          {t('sign_up')}
        </NavLinkItem>
      ) : null}
      <NavLinkItem
        href="/login"
        onClick={e => {
          sendMB('menu-clicked-login', { page: currentUrl })
        }}
      >
        {t('log_in')}
      </NavLinkItem>
    </>
  )
}

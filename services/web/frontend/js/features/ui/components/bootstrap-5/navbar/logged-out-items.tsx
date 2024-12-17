import { useTranslation } from 'react-i18next'
import NavLinkItem from '@/features/ui/components/bootstrap-5/navbar/nav-link-item'
import { useSendProjectListMB } from '@/features/project-list/components/project-list-events'

export default function LoggedOutItems({
  showSignUpLink,
}: {
  showSignUpLink: boolean
}) {
  const { t } = useTranslation()
  const sendMB = useSendProjectListMB()

  return (
    <>
      {showSignUpLink ? (
        <NavLinkItem
          href="/register"
          className="primary nav-account-item"
          onClick={() => {
            sendMB('menu-click', { item: 'register', location: 'top-menu' })
          }}
        >
          {t('sign_up')}
        </NavLinkItem>
      ) : null}
      <NavLinkItem
        href="/login"
        className="nav-account-item"
        onClick={() => {
          sendMB('menu-click', { item: 'login', location: 'top-menu' })
        }}
      >
        {t('log_in')}
      </NavLinkItem>
    </>
  )
}

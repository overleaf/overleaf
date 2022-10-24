import { useTranslation } from 'react-i18next'
import LeftMenuButton from './left-menu-button'

export default function HelpDocumentation() {
  const { t } = useTranslation()

  return (
    <>
      <LeftMenuButton
        type="link"
        href="/learn"
        icon={{
          type: 'book',
          fw: true,
        }}
      >
        {t('documentation')}
      </LeftMenuButton>
    </>
  )
}

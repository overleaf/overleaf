import { useTranslation } from 'react-i18next'
import LeftMenuButton from './left-menu-button'

export default function HelpDocumentation() {
  const { t } = useTranslation()

  return (
    <>
      <LeftMenuButton type="link" href="/learn" icon="book_4">
        {t('documentation')}
      </LeftMenuButton>
    </>
  )
}

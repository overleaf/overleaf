import { useTranslation } from 'react-i18next'
import LeftMenuButton from './left-menu-button'
import { bsVersionIcon } from '@/features/utils/bootstrap-5'

export default function HelpDocumentation() {
  const { t } = useTranslation()

  return (
    <>
      <LeftMenuButton
        type="link"
        href="/learn"
        icon={bsVersionIcon({
          bs5: { type: 'book_4' },
          bs3: { type: 'book', fw: true },
        })}
      >
        {t('documentation')}
      </LeftMenuButton>
    </>
  )
}

import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import OLButton from '@/shared/components/ol/ol-button'
import { useLayoutContext } from '../../../shared/context/layout-context'

function SwitchToPDFButton() {
  const { pdfLayout, setView, detachRole } = useLayoutContext()

  const { t } = useTranslation()

  if (detachRole) {
    return null
  }

  if (pdfLayout === 'sideBySide') {
    return null
  }

  function handleClick() {
    setView('pdf')
  }

  return (
    <OLButton variant="secondary" size="sm" onClick={handleClick}>
      <MaterialIcon type="picture_as_pdf" />
      {t('switch_to_pdf')}
    </OLButton>
  )
}

export default SwitchToPDFButton

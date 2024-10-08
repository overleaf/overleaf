import { useTranslation } from 'react-i18next'
import Icon from '../../../shared/components/icon'
import MaterialIcon from '@/shared/components/material-icon'
import OLButton from '@/features/ui/components/ol/ol-button'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
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
    <OLButton
      variant="secondary"
      size="sm"
      onClick={handleClick}
      bs3Props={{
        bsSize: 'xsmall',
        className: 'switch-to-pdf-btn toolbar-btn-secondary',
      }}
    >
      <BootstrapVersionSwitcher
        bs3={<Icon type="file-pdf-o" className="toolbar-btn-secondary-icon" />}
        bs5={<MaterialIcon type="picture_as_pdf" />}
      />
      {t('switch_to_pdf')}
    </OLButton>
  )
}

export default SwitchToPDFButton

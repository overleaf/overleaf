import { useCallback } from 'react'
import OLButton from '../ui/components/ol/ol-button'
import { useIdeRedesignSwitcherContext } from '../ide-react/context/ide-redesign-switcher-context'
import MaterialIcon from '@/shared/components/material-icon'
import { useTranslation } from 'react-i18next'

const TryNewEditorButton = () => {
  const { t } = useTranslation()
  const { setShowSwitcherModal } = useIdeRedesignSwitcherContext()
  const onClick = useCallback(() => {
    setShowSwitcherModal(true)
  }, [setShowSwitcherModal])
  return (
    <div className="d-flex align-items-center">
      <OLButton
        className="toolbar-experiment-button"
        onClick={onClick}
        size="sm"
        leadingIcon={<MaterialIcon type="experiment" unfilled />}
        variant="info"
      >
        {t('try_the_new_editor')}
      </OLButton>
    </div>
  )
}

export default TryNewEditorButton

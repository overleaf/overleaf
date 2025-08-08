import { useCallback } from 'react'
import OLButton from '../../shared/components/ol/ol-button'
import { useIdeRedesignSwitcherContext } from '../ide-react/context/ide-redesign-switcher-context'
import MaterialIcon from '@/shared/components/material-icon'
import { useTranslation } from 'react-i18next'
import { isNewEditorInBeta } from '../ide-redesign/utils/new-editor-utils'

const TryNewEditorButton = () => {
  const { t } = useTranslation()
  const { setShowSwitcherModal } = useIdeRedesignSwitcherContext()
  const newEditorBeta = isNewEditorInBeta()

  const onClick = useCallback(() => {
    setShowSwitcherModal(true)
  }, [setShowSwitcherModal])
  return (
    <div className="d-flex align-items-center">
      <OLButton
        className="toolbar-experiment-button"
        onClick={onClick}
        size="sm"
        leadingIcon={
          !newEditorBeta && <MaterialIcon type="experiment" unfilled />
        }
        variant="secondary"
      >
        {t('try_the_new_editor')}
      </OLButton>
    </div>
  )
}

export default TryNewEditorButton

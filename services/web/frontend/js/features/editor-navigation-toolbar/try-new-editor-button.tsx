import { useCallback } from 'react'
import OLButton from '../../shared/components/ol/ol-button'
import { useIdeRedesignSwitcherContext } from '../ide-react/context/ide-redesign-switcher-context'
import { useTranslation } from 'react-i18next'
import { canUseNewEditorViaPrimaryFeatureFlag } from '../ide-redesign/utils/new-editor-utils'
import { useSwitchEnableNewEditorState } from '../ide-redesign/hooks/use-switch-enable-new-editor-state'
import { Spinner } from 'react-bootstrap'

const TryNewEditorButton = () => {
  const { t } = useTranslation()
  const { setShowSwitcherModal } = useIdeRedesignSwitcherContext()
  const showModal = canUseNewEditorViaPrimaryFeatureFlag()
  const { loading, setEditorRedesignStatus } = useSwitchEnableNewEditorState()

  const onClick = useCallback(() => {
    if (showModal) {
      setShowSwitcherModal(true)
    } else {
      setEditorRedesignStatus(true)
    }
  }, [setShowSwitcherModal, showModal, setEditorRedesignStatus])

  return (
    <div className="d-flex align-items-center">
      <OLButton
        className="toolbar-experiment-button"
        onClick={onClick}
        size="sm"
        variant="secondary"
      >
        {loading ? (
          <Spinner
            animation="border"
            aria-hidden="true"
            size="sm"
            role="status"
          />
        ) : (
          t('try_the_new_editor')
        )}
      </OLButton>
    </div>
  )
}

export default TryNewEditorButton

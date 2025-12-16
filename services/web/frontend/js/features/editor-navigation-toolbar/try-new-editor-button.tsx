import { useCallback, useState } from 'react'
import OLButton from '../../shared/components/ol/ol-button'
import { useTranslation } from 'react-i18next'
import { useSwitchEnableNewEditorState } from '../ide-redesign/hooks/use-switch-enable-new-editor-state'
import MaterialIcon from '@/shared/components/material-icon'
import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import OldEditorWarningTooltip from '../ide-redesign/components/old-editor-warning-tooltip'

const TryNewEditorButton = () => {
  const { t } = useTranslation()
  const { loading, setEditorRedesignStatus } = useSwitchEnableNewEditorState()
  const { sendEvent } = useEditorAnalytics()
  const isNewEditorOptOutStage = useFeatureFlag('editor-redesign-opt-out')
  const [buttonElt, setButtonElt] = useState<HTMLButtonElement | null>(null)
  const buttonRef = useCallback((node: HTMLButtonElement) => {
    if (node !== null) {
      setButtonElt(node)
    }
  }, [])

  const onClick = useCallback(() => {
    sendEvent('switch-to-new-editor', {
      location: 'toolbar',
    })
    setEditorRedesignStatus(true)
  }, [setEditorRedesignStatus, sendEvent])

  return (
    <div className="d-flex align-items-center">
      <OLButton
        className="toolbar-experiment-button try-new-editor-button"
        onClick={onClick}
        size="sm"
        variant="secondary"
        isLoading={loading}
        ref={buttonRef}
      >
        <MaterialIcon type="fiber_new" />
        {isNewEditorOptOutStage
          ? t('switch_to_new_look')
          : t('try_the_new_editor_design')}
      </OLButton>
      {isNewEditorOptOutStage && <OldEditorWarningTooltip target={buttonElt} />}
    </div>
  )
}

export default TryNewEditorButton

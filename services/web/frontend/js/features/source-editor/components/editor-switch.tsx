import { ChangeEvent, FC, memo, useCallback, useId } from 'react'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import { sendMB } from '../../../infrastructure/event-tracking'
import { useTranslation } from 'react-i18next'
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import { useEditorPropertiesContext } from '@/features/ide-react/context/editor-properties-context'
import { isVisualEditorAvailable } from '../utils/visual-editor'

function EditorSwitch() {
  const { t } = useTranslation()
  const { showVisual: visual, setShowVisual: setVisual } =
    useEditorPropertiesContext()
  const { openDocName } = useEditorOpenDocContext()
  const inputId = useId()

  const richTextAvailable = openDocName
    ? isVisualEditorAvailable(openDocName)
    : false

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const editorType = event.target.value

      switch (editorType) {
        case 'cm6':
          setVisual(false)
          break

        case 'rich-text':
          setVisual(true)
          break
      }

      sendMB('editor-switch-change', { editorType })
    },
    [setVisual]
  )

  return (
    <div
      className="editor-toggle-switch"
      aria-label={t('toolbar_code_visual_editor_switch')}
    >
      <form>
        <fieldset className="toggle-switch">
          <legend className="visually-hidden">Editor mode.</legend>

          <input
            type="radio"
            name="editor"
            value="cm6"
            id={inputId}
            className="toggle-switch-input"
            checked={!richTextAvailable || !visual}
            onChange={handleChange}
          />
          <label htmlFor={inputId} className="toggle-switch-label">
            <span>{t('code_editor')}</span>
          </label>

          <RichTextToggle
            checked={richTextAvailable && visual}
            disabled={!richTextAvailable}
            handleChange={handleChange}
          />
        </fieldset>
      </form>
    </div>
  )
}

const RichTextToggle: FC<{
  checked: boolean
  disabled: boolean
  handleChange: (event: ChangeEvent<HTMLInputElement>) => void
}> = ({ checked, disabled, handleChange }) => {
  const { t } = useTranslation()
  const inputId = useId()

  const toggle = (
    <span>
      <input
        type="radio"
        name="editor"
        value="rich-text"
        id={inputId}
        className="toggle-switch-input"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
      />
      <label htmlFor={inputId} className="toggle-switch-label">
        <span>{t('visual_editor')}</span>
      </label>
    </span>
  )

  if (disabled) {
    return (
      <OLTooltip
        description={t('visual_editor_is_only_available_for_tex_files')}
        id="rich-text-toggle-tooltip"
        overlayProps={{ placement: 'bottom' }}
        tooltipProps={{ className: 'tooltip-wide' }}
      >
        {toggle}
      </OLTooltip>
    )
  }

  return (
    <OLTooltip
      id="rich-text-toggle-tooltip"
      description={t('toolbar_change_editor_mode')}
      overlayProps={{ placement: 'bottom' }}
      tooltipProps={{ className: 'tooltip-wide' }}
    >
      {toggle}
    </OLTooltip>
  )
}

export default memo(EditorSwitch)

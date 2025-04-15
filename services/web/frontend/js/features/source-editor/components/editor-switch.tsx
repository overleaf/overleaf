import { ChangeEvent, FC, memo, useCallback } from 'react'
import useScopeValue from '@/shared/hooks/use-scope-value'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import { sendMB } from '../../../infrastructure/event-tracking'
import { isValidTeXFile } from '../../../main/is-valid-tex-file'
import { useTranslation } from 'react-i18next'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'

function EditorSwitch() {
  const { t } = useTranslation()
  const [visual, setVisual] = useScopeValue('editor.showVisual')
  const { openDocName } = useEditorManagerContext()

  const richTextAvailable = openDocName ? isValidTeXFile(openDocName) : false

  const handleChange = useCallback(
    event => {
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
      <fieldset className="toggle-switch">
        <legend className="sr-only">Editor mode.</legend>

        <input
          type="radio"
          name="editor"
          value="cm6"
          id="editor-switch-cm6"
          className="toggle-switch-input"
          checked={!richTextAvailable || !visual}
          onChange={handleChange}
        />
        <label htmlFor="editor-switch-cm6" className="toggle-switch-label">
          <span>{t('code_editor')}</span>
        </label>

        <RichTextToggle
          checked={richTextAvailable && visual}
          disabled={!richTextAvailable}
          handleChange={handleChange}
        />
      </fieldset>
    </div>
  )
}

const RichTextToggle: FC<{
  checked: boolean
  disabled: boolean
  handleChange: (event: ChangeEvent<HTMLInputElement>) => void
}> = ({ checked, disabled, handleChange }) => {
  const { t } = useTranslation()

  const toggle = (
    <span>
      <input
        type="radio"
        name="editor"
        value="rich-text"
        id="editor-switch-rich-text"
        className="toggle-switch-input"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
      />
      <label htmlFor="editor-switch-rich-text" className="toggle-switch-label">
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

  return toggle
}

export default memo(EditorSwitch)

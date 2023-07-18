import { ChangeEvent, FC, memo, useCallback } from 'react'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import Tooltip from '../../../shared/components/tooltip'
import { sendMB } from '../../../infrastructure/event-tracking'
import getMeta from '../../../utils/meta'
import isValidTeXFile from '../../../main/is-valid-tex-file'
import { useTranslation } from 'react-i18next'
import SplitTestBadge from '../../../shared/components/split-test-badge'

function EditorSwitch() {
  const { t } = useTranslation()
  const [newSourceEditor, setNewSourceEditor] = useScopeValue(
    'editor.newSourceEditor'
  )
  const [richText, setRichText] = useScopeValue('editor.showRichText')
  const [visual, setVisual] = useScopeValue('editor.showVisual')

  const [docName] = useScopeValue('editor.open_doc_name')
  const richTextAvailable = isValidTeXFile(docName)
  const richTextOrVisual = richText || (richTextAvailable && visual)

  const handleChange = useCallback(
    event => {
      const editorType = event.target.value

      switch (editorType) {
        case 'ace':
          setRichText(false)
          setVisual(false)
          setNewSourceEditor(false)
          break

        case 'cm6':
          setRichText(false)
          setVisual(false)
          setNewSourceEditor(true)
          break

        case 'rich-text':
          if (getMeta('ol-richTextVariant') === 'cm6') {
            setRichText(false)
            setVisual(true)
            setNewSourceEditor(true)
          } else {
            setRichText(true)
            setVisual(false)
          }

          break
      }

      sendMB('editor-switch-change', { editorType })
    },
    [setRichText, setVisual, setNewSourceEditor]
  )

  return (
    <div className="editor-toggle-switch">
      <fieldset className="toggle-switch">
        <legend className="sr-only">Editor mode.</legend>

        <input
          type="radio"
          name="editor"
          value="cm6"
          id="editor-switch-cm6"
          className="toggle-switch-input"
          checked={!richTextOrVisual && !!newSourceEditor}
          onChange={handleChange}
        />
        <label htmlFor="editor-switch-cm6" className="toggle-switch-label">
          <span>{t('code_editor')}</span>
        </label>

        <RichTextToggle
          checked={!!richTextOrVisual}
          disabled={!richTextAvailable}
          handleChange={handleChange}
        />
      </fieldset>

      {!!richTextOrVisual && (
        <SplitTestBadge splitTestName="rich-text" displayOnVariants={['cm6']} />
      )}
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
      <Tooltip
        description={t('the_visual_editor_is_only_available_for_tex_files')}
        id="rich-text-toggle-tooltip"
        overlayProps={{ placement: 'bottom' }}
        tooltipProps={{ className: 'tooltip-wide' }}
      >
        {toggle}
      </Tooltip>
    )
  }

  return toggle
}

export default memo(EditorSwitch)

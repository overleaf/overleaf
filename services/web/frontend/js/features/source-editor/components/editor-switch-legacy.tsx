import { ChangeEvent, FC, memo, useCallback } from 'react'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import Tooltip from '../../../shared/components/tooltip'
import { sendMB } from '../../../infrastructure/event-tracking'
import getMeta from '../../../utils/meta'
import isValidTeXFile from '../../../main/is-valid-tex-file'
import { useTranslation } from 'react-i18next'

function Badge() {
  const content = (
    <>
      Overleaf has upgraded the source editor.
      <br />
      You can still use the old editor by selecting "Source (legacy)".
      <br />
      <br />
      Click to learn more and give feedback
    </>
  )

  return (
    <Tooltip
      id="editor-switch"
      description={content}
      overlayProps={{
        placement: 'bottom',
        delayHide: 100,
      }}
      tooltipProps={{ className: 'tooltip-wide' }}
    >
      <a
        href="https://forms.gle/GmSs6odZRKRp3VX98"
        target="_blank"
        rel="noopener noreferrer"
        className="info-badge"
      >
        <span className="sr-only">{content}</span>
      </a>
    </Tooltip>
  )
}

const showLegacySourceEditor: boolean = getMeta('ol-showLegacySourceEditor')

function EditorSwitch() {
  const { t } = useTranslation()
  const [newSourceEditor, setNewSourceEditor] = useScopeValue(
    'editor.newSourceEditor'
  )
  const [visual, setVisual] = useScopeValue('editor.showVisual')

  const [docName] = useScopeValue('editor.open_doc_name')
  const richTextAvailable = isValidTeXFile(docName)
  // TODO: rename this after legacy & toolbar split tests are complete
  const richTextOrVisual = richTextAvailable && visual

  const handleChange = useCallback(
    event => {
      const editorType = event.target.value

      switch (editorType) {
        case 'ace':
          setVisual(false)
          setNewSourceEditor(false)
          break

        case 'cm6':
          setVisual(false)
          setNewSourceEditor(true)
          break

        case 'rich-text':
          setVisual(true)
          setNewSourceEditor(true)

          break
      }

      sendMB('editor-switch-change', { editorType })
    },
    [setVisual, setNewSourceEditor]
  )

  return (
    <div className="editor-toggle-switch">
      {showLegacySourceEditor ? <Badge /> : null}

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

        {showLegacySourceEditor ? (
          <>
            <input
              type="radio"
              name="editor"
              value="ace"
              id="editor-switch-ace"
              className="toggle-switch-input"
              checked={!richTextOrVisual && !newSourceEditor}
              onChange={handleChange}
            />
            <label htmlFor="editor-switch-ace" className="toggle-switch-label">
              <span>Source (legacy)</span>
            </label>
          </>
        ) : null}

        <RichTextToggle
          checked={!!richTextOrVisual}
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
      <Tooltip
        description={t('visual_editor_is_only_available_for_tex_files')}
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

import { memo, useCallback } from 'react'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import Tooltip from '../../../shared/components/tooltip'

function Badge() {
  const content = (
    <>
      Overleaf has upgraded the source editor. You can still use the old editor
      by selecting "Source (legacy)".
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
        className="badge info-badge"
      >
        <span className="sr-only">{content}</span>
      </a>
    </Tooltip>
  )
}

function EditorSwitch() {
  const [newSourceEditor, setNewSourceEditor] = useScopeValue(
    'editor.newSourceEditor'
  )
  const [richText, setRichText] = useScopeValue('editor.showRichText')

  const handleChange = useCallback(
    event => {
      const choice = event.target.value

      switch (choice) {
        case 'ace':
          setRichText(false)
          setNewSourceEditor(false)
          break

        case 'cm6':
          setRichText(false)
          setNewSourceEditor(true)
          break

        case 'rich-text':
          setRichText(true)
          break
      }
    },
    [setRichText, setNewSourceEditor]
  )

  return (
    <div className="editor-toggle-switch">
      <Badge />

      <fieldset className="toggle-switch">
        <legend className="sr-only">Editor mode.</legend>

        <input
          type="radio"
          name="editor"
          value="cm6"
          id="editor-switch-cm6"
          className="toggle-switch-input"
          checked={!richText && !!newSourceEditor}
          onChange={handleChange}
        />
        <label htmlFor="editor-switch-cm6" className="toggle-switch-label">
          <span>Source</span>
        </label>

        <input
          type="radio"
          name="editor"
          value="ace"
          id="editor-switch-ace"
          className="toggle-switch-input"
          checked={!richText && !newSourceEditor}
          onChange={handleChange}
        />
        <label htmlFor="editor-switch-ace" className="toggle-switch-label">
          <span>Source (legacy)</span>
        </label>

        <input
          type="radio"
          name="editor"
          value="rich-text"
          id="editor-switch-rich-text"
          className="toggle-switch-input"
          checked={!!richText}
          onChange={handleChange}
        />
        <label
          htmlFor="editor-switch-rich-text"
          className="toggle-switch-label"
        >
          <span>Rich Text</span>
        </label>
      </fieldset>
    </div>
  )
}

export default memo(EditorSwitch)

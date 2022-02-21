import { memo, useCallback, useMemo } from 'react'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import BetaBadge from '../../../shared/components/beta-badge'

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

  const tooltip = useMemo(() => {
    return {
      id: 'editor-switch-tooltip',
      placement: 'bottom',
      className: 'tooltip-wide',
      text: (
        <>
          We are upgrading the source editor. Please test it by selecting
          "Source (Beta)".
          <br />
          <br />
          Click to learn more and give feedback
        </>
      ),
    }
  }, [])

  return (
    <div className="editor-toggle-switch">
      <BetaBadge tooltip={tooltip} url="https://forms.gle/GmSs6odZRKRp3VX98" />

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
          <span>Source (Beta)</span>
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
          <span>Source</span>
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

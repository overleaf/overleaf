import { memo, useCallback } from 'react'
import { EditorView } from '@codemirror/view'
import { useCodeMirrorViewContext } from '../codemirror-context'
import classnames from 'classnames'
import { emitToolbarEvent } from '../../extensions/toolbar/utils/analytics'
import Icon from '../../../../shared/components/icon'
import MaterialIcon from '@/shared/components/material-icon'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { bsVersion } from '@/features/utils/bootstrap-5'

export const ToolbarButton = memo<{
  id: string
  className?: string
  label: string
  command?: (view: EditorView) => void
  active?: boolean
  disabled?: boolean
  icon: string
  textIcon?: boolean
  hidden?: boolean
  shortcut?: string
}>(function ToolbarButton({
  id,
  className,
  label,
  command,
  active = false,
  disabled,
  icon,
  textIcon = false,
  hidden = false,
  shortcut,
}) {
  const view = useCodeMirrorViewContext()

  const handleMouseDown = useCallback(event => {
    event.preventDefault()
  }, [])

  const handleClick = useCallback(
    event => {
      emitToolbarEvent(view, id)
      if (command) {
        event.preventDefault()
        command(view)
        view.focus()
      }
    },
    [command, view, id]
  )

  const button = (
    <button
      className={classnames(
        'ol-cm-toolbar-button',
        bsVersion({ bs3: 'btn' }),
        className,
        {
          active,
          hidden,
        }
      )}
      aria-label={label}
      onMouseDown={handleMouseDown}
      onClick={!disabled ? handleClick : undefined}
      aria-disabled={disabled}
      type="button"
    >
      {textIcon ? (
        icon
      ) : (
        <BootstrapVersionSwitcher
          bs3={<Icon type={icon} fw accessibilityLabel={label} />}
          bs5={<MaterialIcon type={icon} accessibilityLabel={label} />}
        />
      )}
    </button>
  )

  if (!label) {
    return button
  }

  const description = (
    <>
      <div>{label}</div>
      {shortcut && <div>{shortcut}</div>}
    </>
  )

  return (
    <OLTooltip
      id={id}
      description={description}
      overlayProps={{ placement: 'bottom' }}
    >
      {button}
    </OLTooltip>
  )
})

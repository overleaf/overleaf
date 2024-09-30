import { FC, useRef } from 'react'
import classnames from 'classnames'
import Icon from '../../../../shared/components/icon'
import MaterialIcon from '@/shared/components/material-icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { useCodeMirrorViewContext } from '../codemirror-context'
import OLOverlay from '@/features/ui/components/ol/ol-overlay'
import OLPopover from '@/features/ui/components/ol/ol-popover'
import { bsVersion } from '@/features/utils/bootstrap-5'

export const ToolbarOverflow: FC<{
  overflowed: boolean
  overflowOpen: boolean
  setOverflowOpen: (open: boolean) => void
  overflowRef?: React.Ref<HTMLDivElement>
}> = ({ overflowed, overflowOpen, setOverflowOpen, overflowRef, children }) => {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const view = useCodeMirrorViewContext()

  const className = classnames(
    'ol-cm-toolbar-button',
    'ol-cm-toolbar-overflow-toggle',
    bsVersion({ bs3: 'btn' }),
    {
      'ol-cm-toolbar-overflow-toggle-visible': overflowed,
    }
  )

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        id="toolbar-more"
        className={className}
        aria-label="More"
        onMouseDown={event => {
          event.preventDefault()
          event.stopPropagation()
        }}
        onClick={() => {
          setOverflowOpen(!overflowOpen)
        }}
      >
        <BootstrapVersionSwitcher
          bs3={<Icon type="ellipsis-h" fw />}
          bs5={<MaterialIcon type="more_horiz" />}
        />
      </button>

      <OLOverlay
        show={overflowOpen}
        target={buttonRef.current}
        placement="bottom"
        container={view.dom}
        // containerPadding={0}
        transition
        rootClose
        onHide={() => setOverflowOpen(false)}
      >
        <OLPopover id="popover-toolbar-overflow" ref={overflowRef}>
          <div className="ol-cm-toolbar-overflow">{children}</div>
        </OLPopover>
      </OLOverlay>
    </>
  )
}

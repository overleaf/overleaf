import classnames from 'classnames'
import { useFileTreeActionable } from '../../contexts/file-tree-actionable'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import OLButton from '@/features/ui/components/ol/ol-button'
import MaterialIcon from '@/shared/components/material-icon'

export default function FileTreeModalCreateFileMode({
  mode,
  icon,
  label,
}: {
  mode: string
  icon: string
  label: string
}) {
  const { newFileCreateMode, startCreatingFile } = useFileTreeActionable()

  const handleClick = () => {
    startCreatingFile(mode)
    eventTracking.sendMB('file-modal-click', { method: mode })
  }

  return (
    <li className={classnames({ active: newFileCreateMode === mode })}>
      <OLButton
        variant="link"
        onClick={handleClick}
        className="modal-new-file-mode"
      >
        <MaterialIcon type={icon} />
        &nbsp;
        {label}
      </OLButton>
    </li>
  )
}

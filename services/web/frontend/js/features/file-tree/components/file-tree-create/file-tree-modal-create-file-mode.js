import classnames from 'classnames'
import { Button } from 'react-bootstrap'
import PropTypes from 'prop-types'
import Icon from '../../../../shared/components/icon'
import { useFileTreeActionable } from '../../contexts/file-tree-actionable'
import * as eventTracking from '../../../../infrastructure/event-tracking'

export default function FileTreeModalCreateFileMode({ mode, icon, label }) {
  const { newFileCreateMode, startCreatingFile } = useFileTreeActionable()

  const handleClick = () => {
    startCreatingFile(mode)
    eventTracking.sendMB('file-modal-click', { method: mode })
  }

  return (
    <li className={classnames({ active: newFileCreateMode === mode })}>
      <Button
        bsStyle="link"
        block
        onClick={handleClick}
        className="modal-new-file-mode"
      >
        <Icon type={icon} fw />
        &nbsp;
        {label}
      </Button>
    </li>
  )
}

FileTreeModalCreateFileMode.propTypes = {
  mode: PropTypes.string.isRequired,
  icon: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
}

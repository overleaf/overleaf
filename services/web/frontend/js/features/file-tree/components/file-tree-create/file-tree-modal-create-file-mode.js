import classnames from 'classnames'
import { Button } from 'react-bootstrap'
import PropTypes from 'prop-types'
import Icon from '../../../../shared/components/icon'
import { useFileTreeActionable } from '../../contexts/file-tree-actionable'

export default function FileTreeModalCreateFileMode({ mode, icon, label }) {
  const { newFileCreateMode, startCreatingFile } = useFileTreeActionable()

  const handleClick = () => {
    startCreatingFile(mode)
  }

  return (
    <li className={classnames({ active: newFileCreateMode === mode })}>
      <Button
        bsStyle="link"
        block
        onClick={handleClick}
        className="modal-new-file-mode"
      >
        <Icon modifier="fw" type={icon} />
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

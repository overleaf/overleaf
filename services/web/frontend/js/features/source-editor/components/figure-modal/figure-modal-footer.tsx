import { Button } from 'react-bootstrap'
import {
  FigureModalSource,
  useFigureModalContext,
} from './figure-modal-context'
import Icon from '../../../../shared/components/icon'
import { FC } from 'react'

export const FigureModalFooter: FC<{
  onInsert: () => void
  onCancel: () => void
  onDelete: () => void
}> = ({ onInsert, onCancel, onDelete }) => {
  return (
    <div className="figure-modal-footer">
      <div className="figure-modal-help-buttons">
        <HelpToggle />
      </div>
      <div className="figure-modal-actions">
        <Button
          bsStyle={null}
          className="btn-secondary"
          type="button"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <FigureModalAction onInsert={onInsert} onDelete={onDelete} />
      </div>
    </div>
  )
}

const HelpToggle = () => {
  const { helpShown, dispatch } = useFigureModalContext()
  if (helpShown) {
    return (
      <Button
        bsStyle={null}
        className="btn-link figure-modal-help-link"
        onClick={() => dispatch({ helpShown: false })}
      >
        <Icon type="arrow-left" fw />
        &nbsp;Back
      </Button>
    )
  }
  return (
    <Button
      bsStyle={null}
      className="btn-link figure-modal-help-link"
      onClick={() => dispatch({ helpShown: true })}
    >
      <Icon type="question-circle" fw />
      &nbsp;Help
    </Button>
  )
}

const FigureModalAction: FC<{
  onInsert: () => void
  onDelete: () => void
}> = ({ onInsert, onDelete }) => {
  const { helpShown, getPath, source, sourcePickerShown } =
    useFigureModalContext()

  if (helpShown) {
    return null
  }

  if (sourcePickerShown) {
    return (
      <Button
        bsStyle={null}
        className="btn-danger"
        type="button"
        onClick={onDelete}
      >
        Delete figure
      </Button>
    )
  }

  if (source === FigureModalSource.EDIT_FIGURE) {
    return (
      <Button
        bsStyle={null}
        className="btn-success"
        type="button"
        onClick={onInsert}
      >
        Done
      </Button>
    )
  }

  return (
    <Button
      bsStyle={null}
      className="btn-success"
      type="button"
      disabled={getPath === undefined}
      onClick={onInsert}
    >
      Insert figure
    </Button>
  )
}

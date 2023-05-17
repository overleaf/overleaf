import { Button } from 'react-bootstrap'
import {
  FigureModalSource,
  useFigureModalContext,
} from './figure-modal-context'
import Icon from '../../../../shared/components/icon'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'

export const FigureModalFooter: FC<{
  onInsert: () => void
  onCancel: () => void
  onDelete: () => void
}> = ({ onInsert, onCancel, onDelete }) => {
  const { t } = useTranslation()
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
          {t('cancel')}
        </Button>
        <FigureModalAction onInsert={onInsert} onDelete={onDelete} />
      </div>
    </div>
  )
}

const HelpToggle = () => {
  const { t } = useTranslation()
  const { helpShown, dispatch } = useFigureModalContext()
  if (helpShown) {
    return (
      <Button
        bsStyle={null}
        className="btn-link figure-modal-help-link"
        onClick={() => dispatch({ helpShown: false })}
      >
        <Icon type="arrow-left" fw />
        &nbsp;{t('back')}
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
      &nbsp;{t('help')}
    </Button>
  )
}

const FigureModalAction: FC<{
  onInsert: () => void
  onDelete: () => void
}> = ({ onInsert, onDelete }) => {
  const { t } = useTranslation()
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
        {t('delete_figure')}
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
        {t('done')}
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
      {t('insert_figure')}
    </Button>
  )
}

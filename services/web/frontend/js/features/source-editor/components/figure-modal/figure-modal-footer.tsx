import {
  FigureModalSource,
  useFigureModalContext,
} from './figure-modal-context'
import Icon from '../../../../shared/components/icon'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { sendMB } from '../../../../infrastructure/event-tracking'
import OLButton from '@/features/ui/components/ol/ol-button'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import MaterialIcon from '@/shared/components/material-icon'
import { bsVersion } from '@/features/utils/bootstrap-5'
import classnames from 'classnames'

export const FigureModalFooter: FC<{
  onInsert: () => void
  onCancel: () => void
  onDelete: () => void
}> = ({ onInsert, onCancel, onDelete }) => {
  const { t } = useTranslation()

  return (
    <>
      <HelpToggle />
      <OLButton variant="secondary" onClick={onCancel}>
        {t('cancel')}
      </OLButton>
      <FigureModalAction onInsert={onInsert} onDelete={onDelete} />
      <BootstrapVersionSwitcher bs3={<div className="clearfix" />} />
    </>
  )
}

const HelpToggle = () => {
  const { t } = useTranslation()
  const { helpShown, dispatch } = useFigureModalContext()
  if (helpShown) {
    return (
      <OLButton
        variant="link"
        className={classnames(
          'figure-modal-help-link',
          bsVersion({ bs3: 'pull-left', bs5: 'me-auto' })
        )}
        onClick={() => dispatch({ helpShown: false })}
      >
        <BootstrapVersionSwitcher
          bs3={<Icon type="arrow-left" fw />}
          bs5={
            <span>
              <MaterialIcon
                type="arrow_left_alt"
                className="align-text-bottom"
              />
            </span>
          }
        />{' '}
        {t('back')}
      </OLButton>
    )
  }
  return (
    <OLButton
      variant="link"
      className={classnames(
        'figure-modal-help-link',
        bsVersion({ bs3: 'pull-left', bs5: 'me-auto' })
      )}
      onClick={() => dispatch({ helpShown: true })}
    >
      <BootstrapVersionSwitcher
        bs3={<Icon type="question-circle" fw />}
        bs5={
          <span>
            <MaterialIcon type="help" className="align-text-bottom" />
          </span>
        }
      />{' '}
      {t('help')}
    </OLButton>
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
      <OLButton variant="danger" onClick={onDelete}>
        {t('delete_figure')}
      </OLButton>
    )
  }

  if (source === FigureModalSource.EDIT_FIGURE) {
    return (
      <OLButton
        variant="primary"
        onClick={() => {
          onInsert()
          sendMB('figure-modal-edit')
        }}
      >
        {t('done')}
      </OLButton>
    )
  }

  return (
    <OLButton
      variant="primary"
      disabled={getPath === undefined}
      onClick={() => {
        onInsert()
        sendMB('figure-modal-insert')
      }}
    >
      {t('insert_figure')}
    </OLButton>
  )
}

import { FC } from 'react'
import {
  FigureModalSource,
  useFigureModalContext,
} from './figure-modal-context'
import Icon from '../../../../shared/components/icon'
import { Button } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'

export const FigureModalSourcePicker: FC = () => {
  const { t } = useTranslation()
  return (
    <div className="figure-modal-source-selector">
      <div className="figure-modal-source-button-row">
        <FigureModalSourceButton
          type={FigureModalSource.FILE_UPLOAD}
          title={t('replace_from_computer')}
          icon="upload"
        />
        <FigureModalSourceButton
          type={FigureModalSource.OTHER_PROJECT}
          title={t('replace_from_another_project')}
          icon="folder-open"
        />
      </div>
      <div className="figure-modal-source-button-row">
        <FigureModalSourceButton
          type={FigureModalSource.FILE_TREE}
          title={t('replace_from_project_files')}
          icon="archive"
        />
        <FigureModalSourceButton
          type={FigureModalSource.FROM_URL}
          title={t('replace_from_url')}
          icon="globe"
        />
      </div>
    </div>
  )
}

const FigureModalSourceButton: FC<{
  type: FigureModalSource
  title: string
  icon: string
}> = ({ type, title, icon }) => {
  const { dispatch } = useFigureModalContext()
  return (
    <Button
      bsStyle={null}
      bsClass=""
      className="figure-modal-source-button"
      onClick={() => {
        dispatch({ source: type, sourcePickerShown: false, getPath: undefined })
      }}
    >
      <Icon
        type={icon}
        className="figure-modal-source-button-icon source-icon"
        fw
      />
      <span className="figure-modal-source-button-title">{title}</span>
      <Icon
        type="chevron-right"
        className="figure-modal-source-button-icon"
        fw
      />
    </Button>
  )
}

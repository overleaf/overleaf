import { FC } from 'react'
import {
  FigureModalSource,
  useFigureModalContext,
} from './figure-modal-context'
import { useTranslation } from 'react-i18next'
import getMeta from '@/utils/meta'
import MaterialIcon from '@/shared/components/material-icon'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'

export const FigureModalSourcePicker: FC = () => {
  const { t } = useTranslation()
  const {
    hasLinkedProjectFileFeature,
    hasLinkedProjectOutputFileFeature,
    hasLinkUrlFeature,
  } = getMeta('ol-ExposedSettings')

  const { write } = usePermissionsContext()

  return (
    <div className="figure-modal-source-button-grid">
      {write && (
        <FigureModalSourceButton
          type={FigureModalSource.FILE_UPLOAD}
          title={t('replace_from_computer')}
          icon="upload"
        />
      )}
      <FigureModalSourceButton
        type={FigureModalSource.FILE_TREE}
        title={t('replace_from_project_files')}
        icon="inbox"
      />
      {write &&
        (hasLinkedProjectFileFeature || hasLinkedProjectOutputFileFeature) && (
          <FigureModalSourceButton
            type={FigureModalSource.OTHER_PROJECT}
            title={t('replace_from_another_project')}
            icon="folder_open"
          />
        )}
      {write && hasLinkUrlFeature && (
        <FigureModalSourceButton
          type={FigureModalSource.FROM_URL}
          title={t('replace_from_url')}
          icon="public"
        />
      )}
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
    <button
      type="button"
      className="figure-modal-source-button"
      onClick={() => {
        dispatch({ source: type, sourcePickerShown: false, getPath: undefined })
      }}
    >
      <MaterialIcon type={icon} className="figure-modal-source-button-icon" />
      <span className="figure-modal-source-button-title">{title}</span>
      <MaterialIcon type="chevron_right" />
    </button>
  )
}

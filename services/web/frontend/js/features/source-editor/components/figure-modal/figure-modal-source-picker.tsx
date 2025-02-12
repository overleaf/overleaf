import { FC } from 'react'
import {
  FigureModalSource,
  useFigureModalContext,
} from './figure-modal-context'
import Icon from '../../../../shared/components/icon'
import { useTranslation } from 'react-i18next'
import getMeta from '@/utils/meta'
import MaterialIcon from '@/shared/components/material-icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { bsVersion } from '@/features/utils/bootstrap-5'
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
          icon={bsVersion({ bs3: 'upload', bs5: 'upload' })}
        />
      )}
      <FigureModalSourceButton
        type={FigureModalSource.FILE_TREE}
        title={t('replace_from_project_files')}
        icon={bsVersion({ bs3: 'archive', bs5: 'inbox' })}
      />
      {write &&
        (hasLinkedProjectFileFeature || hasLinkedProjectOutputFileFeature) && (
          <FigureModalSourceButton
            type={FigureModalSource.OTHER_PROJECT}
            title={t('replace_from_another_project')}
            icon={bsVersion({ bs3: 'folder-open', bs5: 'folder_open' })}
          />
        )}
      {write && hasLinkUrlFeature && (
        <FigureModalSourceButton
          type={FigureModalSource.FROM_URL}
          title={t('replace_from_url')}
          icon={bsVersion({ bs3: 'globe', bs5: 'public' })}
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
      <BootstrapVersionSwitcher
        bs3={
          <Icon type={icon} className="figure-modal-source-button-icon" fw />
        }
        bs5={
          <MaterialIcon
            type={icon}
            className="figure-modal-source-button-icon"
          />
        }
      />
      <span className="figure-modal-source-button-title">{title}</span>
      <BootstrapVersionSwitcher
        bs3={<Icon type="chevron-right" fw />}
        bs5={<MaterialIcon type="chevron_right" />}
      />
    </button>
  )
}

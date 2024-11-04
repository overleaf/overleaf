import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from '@/shared/components/icon'
import { useIncludedFile } from '@/features/source-editor/hooks/use-included-file'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import MaterialIcon from '@/shared/components/material-icon'
import OLButton from '@/features/ui/components/ol/ol-button'

export const IncludeTooltipContent: FC = () => {
  const { t } = useTranslation()
  const { openIncludedFile } = useIncludedFile('IncludeArgument')

  return (
    <div className="ol-cm-command-tooltip-content">
      <OLButton
        variant="link"
        type="button"
        className="ol-cm-command-tooltip-link"
        onClick={openIncludedFile}
      >
        <BootstrapVersionSwitcher
          bs3={<Icon type="edit" fw />}
          bs5={<MaterialIcon type="edit" />}
        />
        {t('open_file')}
      </OLButton>
    </div>
  )
}

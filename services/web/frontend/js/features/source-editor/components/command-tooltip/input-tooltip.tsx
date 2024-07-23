import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from 'react-bootstrap'
import Icon from '@/shared/components/icon'
import { useIncludedFile } from '@/features/source-editor/hooks/use-included-file'

export const InputTooltipContent: FC = () => {
  const { t } = useTranslation()
  const { openIncludedFile } = useIncludedFile('InputArgument')

  return (
    <div className="ol-cm-command-tooltip-content">
      <Button
        type="button"
        bsStyle="link"
        className="ol-cm-command-tooltip-link"
        onClick={openIncludedFile}
      >
        <Icon type="edit" fw />
        {t('open_file')}
      </Button>
    </div>
  )
}

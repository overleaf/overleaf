import { useTranslation } from 'react-i18next'
import EditorTourTooltip from './editor-tour-tooltip'

export default function EditorTourLogsTooltip({
  target,
}: {
  target: HTMLElement | null
}) {
  const { t } = useTranslation()

  return (
    <EditorTourTooltip
      target={target}
      placement="bottom"
      stage="logs"
      header={t('find_and_fix_errors_faster')}
    >
      {t('new_error_logs_make_it_easier_to_find_whats_wrong')}
    </EditorTourTooltip>
  )
}

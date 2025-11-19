import { useTranslation } from 'react-i18next'
import EditorTourTooltip from './editor-tour-tooltip'

export default function EditorTourRailTooltip({
  target,
}: {
  target: HTMLElement | null
}) {
  const { t } = useTranslation()

  return (
    <EditorTourTooltip
      target={target}
      placement="right-start"
      stage="rail"
      header={t('simplified_working_starts_here')}
    >
      {t('switch_easily_between_your_files_comments_track_changes_and_more')}
    </EditorTourTooltip>
  )
}

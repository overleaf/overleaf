import { Trans, useTranslation } from 'react-i18next'
import EditorTourTooltip from './editor-tour-tooltip'

export default function EditorTourThemeTooltip({
  target,
}: {
  target: HTMLElement | null
}) {
  const { t } = useTranslation()

  return (
    <EditorTourTooltip
      target={target}
      placement="right-end"
      stage="theme"
      header={t('switch_between_dark_and_light_mode')}
    >
      <Trans
        i18nKey="change_how_you_see_the_editor"
        components={{ strong: <strong /> }}
      />
    </EditorTourTooltip>
  )
}

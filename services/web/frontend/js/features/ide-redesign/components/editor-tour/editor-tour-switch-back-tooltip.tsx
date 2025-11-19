import { Trans, useTranslation } from 'react-i18next'
import EditorTourTooltip from './editor-tour-tooltip'

export default function EditorTourSwitchBackTooltip({
  target,
}: {
  target: HTMLElement | null
}) {
  const { t } = useTranslation()

  return (
    <EditorTourTooltip
      target={target}
      placement="right-end"
      stage="switch-back"
      header={t('not_sure_about_switching_yet')}
    >
      <Trans
        i18nKey="read_more_about_the_new_editor"
        components={[
          /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
          <a
            href="https://www.overleaf.com/blog/introducing-overleafs-new-look"
            target="_blank"
            rel="noopener noreferrer"
            key="link"
          />,
          <strong key="strong" />,
        ]}
      />
    </EditorTourTooltip>
  )
}

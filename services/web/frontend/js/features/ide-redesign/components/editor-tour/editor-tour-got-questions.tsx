import { Trans, useTranslation } from 'react-i18next'
import EditorTourTooltip from './editor-tour-tooltip'

export default function EditorTourGotQuestionsTooltip({
  target,
}: {
  target: HTMLElement | null
}) {
  const { t } = useTranslation()
  return (
    <EditorTourTooltip
      target={target}
      placement="right-end"
      stage="got-questions"
      header={t('got_questions')}
    >
      <Trans
        i18nKey="read_more_about_the_new_editor_or_explore_our_documentation_for_tips_and_tricks"
        components={[
          /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
          <a
            href="https://www.overleaf.com/blog/introducing-overleafs-new-look"
            target="_blank"
            rel="noopener noreferrer"
            key="link"
          />,
          /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
          <a
            href="https://docs.overleaf.com/getting-started/how-do-i-use-overleaf/redesigned-overleaf-editor"
            target="_blank"
            rel="noopener noreferrer"
            key="link"
          />,
        ]}
      />
    </EditorTourTooltip>
  )
}

import { Trans, useTranslation } from 'react-i18next'
import EditorTourTooltip from './editor-tour-tooltip'
import { useFeatureFlag } from '@/shared/context/split-test-context'

export default function EditorTourSwitchBackTooltip({
  target,
}: {
  target: HTMLElement | null
}) {
  const { t } = useTranslation()
  // NOTE: This should really be a different component, but to reduce
  // complexity of the tour code, let's just change the content here.
  // The feature flag can be torn down soon, and the component renamed.
  const noOptOut = useFeatureFlag('editor-redesign-no-opt-out')
  const canSwitchBack = !noOptOut

  return (
    <EditorTourTooltip
      target={target}
      placement="right-end"
      stage="switch-back"
      header={
        canSwitchBack ? t('not_sure_about_switching_yet') : t('got_questions')
      }
    >
      {canSwitchBack ? (
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
      ) : (
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
      )}
    </EditorTourTooltip>
  )
}

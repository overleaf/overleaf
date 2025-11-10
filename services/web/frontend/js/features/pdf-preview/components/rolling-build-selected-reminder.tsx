import OLNotification from '@/shared/components/ol/ol-notification'
import { useTranslation, Trans } from 'react-i18next'
import { useProjectContext } from '@/shared/context/project-context'
import { onRollingBuild } from '@/shared/utils/rolling-build'

const RollingBuildSelectedReminder = () => {
  const { t } = useTranslation()
  const { project } = useProjectContext()

  if (!onRollingBuild(project?.imageName)) {
    return null
  }

  const content = (
    <Trans
      i18nKey="if_you_find_any_issues_with_texlive"
      components={[
        <a href="https://forms.gle/yD8CVm4Kop9KwShx9" />, // eslint-disable-line react/jsx-key, jsx-a11y/anchor-has-content
        <a href="https://docs.overleaf.com/getting-started/recompiling-your-project/selecting-a-tex-live-version-and-latex-compiler" />, // eslint-disable-line react/jsx-key, jsx-a11y/anchor-has-content
      ]}
    />
  )

  return (
    <OLNotification
      title={t('this_project_is_compiled_using_untested_version')}
      content={content}
      type="info"
    />
  )
}

export default RollingBuildSelectedReminder

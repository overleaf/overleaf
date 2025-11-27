import { useCallback, useState } from 'react'
import LabsExperimentWidget from '../../shared/components/labs/labs-experiments-widget'
import { isInExperiment } from '@/utils/labs-utils'
import { useTranslation, Trans } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'
import { postJSON } from '@/infrastructure/fetch-json'
import { debugConsole } from '@/utils/debugging'

export const TUTORIAL_KEY = 'rolling-compile-image-changed'

const MonthlyTexliveLabsWidget = ({
  labsProgram,
  setErrorMessage,
}: {
  labsProgram: boolean
  setErrorMessage: (err: string) => void
}) => {
  const { t } = useTranslation()
  const [optedIn, setOptedIn] = useState(isInExperiment('monthly-texlive'))

  const optInWithCompletedTutorial = useCallback(
    async (shouldOptIn: boolean) => {
      try {
        await postJSON(`/tutorial/${TUTORIAL_KEY}/complete`)
      } catch (err) {
        debugConsole.error(err)
      }
      setOptedIn(shouldOptIn)
    },
    [setOptedIn]
  )

  const monthlyTexLiveSplitTestEnabled = isSplitTestEnabled('monthly-texlive')
  if (!monthlyTexLiveSplitTestEnabled) {
    return null
  }

  const logo = (
    <MaterialIcon
      type="construction"
      size="2x"
      className="rounded bg-primary-subtle"
    />
  )

  const optedInDescription = (
    <Trans
      i18nKey="thank_you_for_joining_the_rolling_texlive"
      components={[
        // eslint-disable-next-line jsx-a11y/anchor-has-content
        <a
          href="/learn/latex/Overleaf_and_TeX_Live#How_do_I_change_a_project’s_TeX_Live_version?"
          target="_blank"
          key="getting-started-link"
        />,
      ]}
    />
  )

  const description = (
    <Trans
      i18nKey="this_experiment_gives_you_access_to_new_versions_of_latex"
      components={[
        // eslint-disable-next-line jsx-a11y/anchor-has-content
        <a
          href="https://docs.overleaf.com/troubleshooting-and-support/tex-live#How_do_I_change_a_project%E2%80%99s_TeX_Live_version"
          target="_blank"
          key="getting-started-link"
          rel="noopener"
        />,
        // eslint-disable-next-line jsx-a11y/anchor-has-content
        <a
          href="https://docs.overleaf.com/troubleshooting-and-support/tex-live"
          target="_blank"
          key="getting-started-link"
          rel="noopener"
        />,
      ]}
    />
  )

  return (
    <LabsExperimentWidget
      description={description}
      optedInDescription={optedInDescription}
      experimentName="monthly-texlive"
      logo={logo}
      labsEnabled={labsProgram}
      setErrorMessage={setErrorMessage}
      optedIn={optedIn}
      setOptedIn={optInWithCompletedTutorial}
      title={t('rolling_texlive_build')}
    />
  )
}

export const hidden = () => !isSplitTestEnabled('monthly-texlive')

export default MonthlyTexliveLabsWidget

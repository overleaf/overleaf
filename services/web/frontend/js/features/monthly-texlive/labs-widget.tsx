import { useCallback, useState } from 'react'
import LabsExperimentWidget from '../../shared/components/labs/labs-experiments-widget'
import { isInExperiment } from '@/utils/labs-utils'
import { useTranslation } from 'react-i18next'
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
  return (
    <LabsExperimentWidget
      description={t('test_more_recent_versions_of_texlive')}
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

export default MonthlyTexliveLabsWidget

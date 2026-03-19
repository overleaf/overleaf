import LabsExperimentWidget, {
  LabsExperimentWidgetProps,
} from '@/shared/components/labs/labs-experiments-widget'
import { isInExperiment } from '@/utils/labs-utils'
import { useState } from 'react'
import MaterialIcon from '@/shared/components/material-icon'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'

type LabsWidgetProps = Pick<LabsExperimentWidgetProps, 'setErrorMessage'> & {
  labsProgram: boolean
}

const LabsWidget = ({ setErrorMessage, labsProgram }: LabsWidgetProps) => {
  const [optedIn, setOptedIn] = useState(isInExperiment('editor-tabs'))

  const description = (
    <span>Quickly switch between open files and documents using tabs.</span>
  )

  return (
    <LabsExperimentWidget
      description={description}
      experimentName="editor-tabs"
      title="Editor tabs"
      setOptedIn={setOptedIn}
      setErrorMessage={setErrorMessage}
      optedIn={optedIn}
      logo={
        <MaterialIcon
          type="tab_group"
          className="rounded bg-primary-subtle labs-experiment-icon"
        />
      }
      optedInDescription={description}
      labsEnabled={labsProgram}
    />
  )
}

export const hidden = () => !isSplitTestEnabled('tabs-experiment')

export default LabsWidget

import { useState } from 'react'
import ToggleSwitchComponent from '../../js/features/history/components/change-list/toggle-switch'

export const LabelsOnlyToggleSwitch = () => {
  const [labelsOnly, setLabelsOnly] = useState(false)

  return (
    <ToggleSwitchComponent
      labelsOnly={labelsOnly}
      setLabelsOnly={setLabelsOnly}
    />
  )
}

export default {
  title: 'History / Change list',
  component: ToggleSwitchComponent,
  argTypes: {
    labelsOnly: {
      table: {
        disable: true,
      },
    },
    setLabelsOnly: {
      table: {
        disable: true,
      },
    },
  },
  decorators: [
    (Story: React.ComponentType) => (
      <div className="history-react">
        <div className="change-list">
          <div className="history-header history-toggle-switch-container">
            <Story />
          </div>
        </div>
      </div>
    ),
  ],
}

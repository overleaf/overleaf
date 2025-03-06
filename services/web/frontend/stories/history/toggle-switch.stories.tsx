import { useState } from 'react'
import ToggleSwitchComponent from '../../js/features/history/components/change-list/toggle-switch'
import { ScopeDecorator } from '../decorators/scope'
import { HistoryProvider } from '../../js/features/history/context/history-context'

export const HistoryAndLabelsToggleSwitch = () => {
  const [labelsOnly, setLabelsOnly] = useState(false)

  return (
    <HistoryProvider>
      <ToggleSwitchComponent
        labelsOnly={labelsOnly}
        setLabelsOnly={setLabelsOnly}
      />
    </HistoryProvider>
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
    ScopeDecorator,
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

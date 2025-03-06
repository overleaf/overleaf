import LabelListItemComponent from '../../js/features/history/components/change-list/label-list-item'
import { ScopeDecorator } from '../decorators/scope'
import { HistoryProvider } from '../../js/features/history/context/history-context'
import { disableControlsOf } from '../utils/arg-types'

const labels = [
  {
    id: '643561cdfa2b2beac88f0024',
    comment: 'tag-1',
    version: 1,
    user_id: '123',
    created_at: '2023-04-11T13:34:05.856Z',
    user_display_name: 'john.doe',
  },
  {
    id: '643561d1fa2b2beac88f0025',
    comment: 'tag-2',
    version: 1,
    user_id: '123',
    created_at: '2023-04-11T13:34:09.280Z',
    user_display_name: 'john.doe',
  },
]

export const LabelVersion = (
  args: React.ComponentProps<typeof LabelListItemComponent>
) => {
  return (
    <HistoryProvider>
      <LabelListItemComponent {...args} />
    </HistoryProvider>
  )
}

export default {
  title: 'History / Change list',
  component: LabelListItemComponent,
  args: {
    labels,
    version: 1,
    currentUserId: '1',
    projectId: '123',
    comparing: false,
    selectionState: false,
    selectable: false,
    setSelection: () => {},
    dropdownOpen: false,
    dropdownActive: false,
    setActiveDropdownItem: () => {},
    closeDropdownForItem: () => {},
  },
  argTypes: {
    ...disableControlsOf(
      'labels',
      'version',
      'currentUserId',
      'projectId',
      'setSelection',
      'dropdownOpen',
      'dropdownActive',
      'setActiveDropdownItem',
      'closeDropdownForItem'
    ),
  },
  decorators: [
    ScopeDecorator,
    (Story: React.ComponentType) => (
      <div className="history-react">
        <div className="change-list">
          <div className="history-version-list-container">
            <Story />
          </div>
        </div>
      </div>
    ),
  ],
}

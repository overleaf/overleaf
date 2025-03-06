import HistoryVersionComponent from '../../js/features/history/components/change-list/history-version'
import { ScopeDecorator } from '../decorators/scope'
import { HistoryProvider } from '../../js/features/history/context/history-context'
import { disableControlsOf } from '../utils/arg-types'

const update = {
  fromV: 3,
  toV: 4,
  meta: {
    users: [
      {
        first_name: 'john.doe',
        last_name: '',
        email: 'john.doe@test.com',
        id: '631710ab1094c5002647184e',
      },
    ],
    start_ts: 1681220036419,
    end_ts: 1681220036419,
  },
  labels: [
    {
      id: '643561cdfa2b2beac88f0024',
      comment: 'tag-1',
      version: 4,
      user_id: '123',
      created_at: '2023-04-11T13:34:05.856Z',
      user_display_name: 'john.doe',
    },
    {
      id: '643561d1fa2b2beac88f0025',
      comment: 'tag-2',
      version: 4,
      user_id: '123',
      created_at: '2023-04-11T13:34:09.280Z',
      user_display_name: 'john.doe',
    },
  ],
  pathnames: [],
  project_ops: [{ add: { pathname: 'name.tex' }, atV: 3 }],
}

export const HistoryVersion = (
  args: React.ComponentProps<typeof HistoryVersionComponent>
) => {
  return (
    <HistoryProvider>
      <HistoryVersionComponent {...args} />
    </HistoryProvider>
  )
}

export default {
  title: 'History / Change list',
  component: HistoryVersionComponent,
  args: {
    update,
    currentUserId: '1',
    projectId: '123',
    comparing: false,
    faded: false,
    showDivider: false,
    selectionState: false,
    setSelection: () => {},
    dropdownOpen: false,
    dropdownActive: false,
    setActiveDropdownItem: () => {},
    closeDropdownForItem: () => {},
  },
  argTypes: {
    ...disableControlsOf(
      'update',
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

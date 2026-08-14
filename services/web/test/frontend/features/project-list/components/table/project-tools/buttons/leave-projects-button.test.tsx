import { fireEvent, screen, render } from '@testing-library/react'
import LeaveProjectsButton from '../../../../../../../../frontend/js/features/project-list/components/table/project-tools/buttons/leave-projects-button'
import { makeLongProjectList } from '../../../../fixtures/projects-data'
import {
  ProjectListContext,
  ProjectListContextValue,
} from '../../../../../../../../frontend/js/features/project-list/context/project-list-context'
import { SplitTestProvider } from '@/shared/context/split-test-context'

const { leavableList } = makeLongProjectList(40)

describe('<LeaveProjectsButton />', function () {
  it('opens the modal when clicked', function () {
    const value = {
      selectedProjects: leavableList,
      hasDeletableProjectsSelected: false,
      hasLeavableProjectsSelected: true,
    } as ProjectListContextValue

    render(
      <SplitTestProvider>
        <ProjectListContext.Provider value={value}>
          <LeaveProjectsButton />
        </ProjectListContext.Provider>
      </SplitTestProvider>
    )
    const btn = screen.getByRole('button', { name: /leave/i })
    fireEvent.click(btn)
    screen.getByRole('heading', { name: /leave projects/i })
  })
})

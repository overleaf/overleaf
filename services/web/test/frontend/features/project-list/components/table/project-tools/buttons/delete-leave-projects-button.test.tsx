import { fireEvent, screen, render } from '@testing-library/react'
import DeleteLeaveProjectsButton from '../../../../../../../../frontend/js/features/project-list/components/table/project-tools/buttons/delete-leave-projects-button'
import { makeLongProjectList } from '../../../../fixtures/projects-data'
import {
  ProjectListContext,
  ProjectListContextValue,
} from '../../../../../../../../frontend/js/features/project-list/context/project-list-context'

const { deletableList, leavableList } = makeLongProjectList(40)

describe('<DeleteLeaveProjectsButton />', function () {
  it('opens the modal when clicked', function () {
    const value = {
      selectedProjects: [...deletableList, ...leavableList],
      hasDeletableProjectsSelected: true,
      hasLeavableProjectsSelected: true,
    } as ProjectListContextValue

    render(
      <ProjectListContext.Provider value={value}>
        <DeleteLeaveProjectsButton />
      </ProjectListContext.Provider>
    )

    const btn = screen.getByRole('button', { name: /delete \/ leave/i })
    fireEvent.click(btn)
    screen.getByRole('heading', { name: /delete and leave projects/i })
  })
})

import { fireEvent, screen, render } from '@testing-library/react'
import DeleteProjectsButton from '../../../../../../../../frontend/js/features/project-list/components/table/project-tools/buttons/delete-projects-button'
import { makeLongProjectList } from '../../../../fixtures/projects-data'
import {
  ProjectListContext,
  ProjectListContextValue,
} from '../../../../../../../../frontend/js/features/project-list/context/project-list-context'
import { SplitTestProvider } from '@/shared/context/split-test-context'

const { deletableList } = makeLongProjectList(40)

describe('<DeleteProjectsButton />', function () {
  it('opens the modal when clicked', function () {
    const value = {
      selectedProjects: deletableList,
      hasDeletableProjectsSelected: true,
      hasLeavableProjectsSelected: false,
    } as ProjectListContextValue

    render(
      <SplitTestProvider>
        <ProjectListContext.Provider value={value}>
          <DeleteProjectsButton />
        </ProjectListContext.Provider>
      </SplitTestProvider>
    )

    const btn = screen.getByRole('button', { name: /delete/i })
    fireEvent.click(btn)
    screen.getByRole('heading', { name: /delete projects/i })
  })
})

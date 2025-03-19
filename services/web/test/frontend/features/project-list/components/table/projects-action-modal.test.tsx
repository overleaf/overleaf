import { expect } from 'chai'
import sinon from 'sinon'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import ProjectsActionModal from '../../../../../../frontend/js/features/project-list/components/modals/projects-action-modal'
import { projectsData } from '../../fixtures/projects-data'
import {
  resetProjectListContextFetch,
  renderWithProjectListContext,
} from '../../helpers/render-with-context'
import * as eventTracking from '@/infrastructure/event-tracking'

describe('<ProjectsActionModal />', function () {
  const actionHandler = sinon.stub().resolves({})
  let sendMBSpy: sinon.SinonSpy

  beforeEach(function () {
    sendMBSpy = sinon.spy(eventTracking, 'sendMB')
  })

  afterEach(function () {
    sendMBSpy.restore()
    resetProjectListContextFetch()
  })

  it('should handle the action passed', async function () {
    renderWithProjectListContext(
      <ProjectsActionModal
        action="archive"
        actionHandler={actionHandler}
        projects={[projectsData[0], projectsData[1]]}
        handleCloseModal={() => {}}
        showModal
      />
    )
    const confirmBtn = screen.getByRole('button', {
      name: 'Confirm',
    }) as HTMLButtonElement
    fireEvent.click(confirmBtn)
    expect(confirmBtn.disabled).to.be.true
    // verify action handled
    await waitFor(() => expect(actionHandler.callCount).to.equal(2))
  })

  it('should show an error message for all actions that fail', async function () {
    actionHandler
      .withArgs(projectsData[2])
      .rejects(new Error('Something went wrong. Please try again.'))
    actionHandler
      .withArgs(projectsData[3])
      .rejects(new Error('Something went wrong. Please try again.'))

    renderWithProjectListContext(
      <ProjectsActionModal
        action="archive"
        actionHandler={actionHandler}
        projects={[
          projectsData[0],
          projectsData[1],
          projectsData[2],
          projectsData[3],
        ]}
        handleCloseModal={() => {}}
        showModal
      />
    )
    const confirmBtn = screen.getByText('Confirm') as HTMLButtonElement
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert')
      expect(alerts.length).to.equal(2)
      expect(alerts[0].textContent).to.contain(
        `${projectsData[2].name}Something went wrong. Please try again.`
      )
      expect(alerts[1].textContent).to.contain(
        `${projectsData[3].name}Something went wrong. Please try again.`
      )
    })
  })

  it('should send an analytics event when opened', function () {
    renderWithProjectListContext(
      <ProjectsActionModal
        action="archive"
        actionHandler={actionHandler}
        projects={[projectsData[0], projectsData[1]]}
        handleCloseModal={() => {}}
        showModal
      />
    )

    expect(sendMBSpy).to.have.been.calledOnce
    expect(sendMBSpy).to.have.been.calledWith('project-list-page-interaction', {
      action: 'archive',
      page: '/',
      isSmallDevice: true,
    })
  })
})

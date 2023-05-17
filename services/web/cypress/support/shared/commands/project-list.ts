export const interceptProjectListing = () => {
  cy.intercept('GET', '/user/projects', {
    projects: [
      {
        _id: 'fake-project-1',
        accessLevel: 'owner',
        name: 'My first project',
      },
      {
        _id: 'fake-project-2',
        accessLevel: 'owner',
        name: 'My second project',
      },
    ],
  })
  cy.intercept('GET', '/project/*/entities', {
    entities: [
      { path: '/frog.jpg', type: 'file' },
      { path: 'figures/unicorn.png', type: 'file' },
    ],
  })
}

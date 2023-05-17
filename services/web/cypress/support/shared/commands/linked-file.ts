import { HttpRequestInterceptor } from 'cypress/types/net-stubbing'

export const interceptLinkedFile = () => {
  cy.intercept(
    { method: 'POST', url: '/project/*/linked_file' },
    cy
      .spy((req: Parameters<HttpRequestInterceptor>[0]) => {
        req.reply({ statusCode: 200, body: { success: true } })
      })
      .as('linked-file-request')
  )
}

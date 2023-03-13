import { RouteHandler, RouteMatcher } from 'cypress/types/net-stubbing'

export const interceptAsync = (route: RouteMatcher, alias: string) => {
  const deferred: { resolve: (value: RouteHandler) => void } = {
    resolve: () => {},
  }

  const promise = new Promise<RouteHandler>(resolve => {
    deferred.resolve = resolve
  })

  cy.intercept(route, req => {
    return promise.then(response => req.reply(response))
  }).as(alias)

  return cy.wrap(deferred)
}

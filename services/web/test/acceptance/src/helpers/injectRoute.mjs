/**
 * Used to inject an endpoint into our app that should only be available
 * when running in the test environment.
 *
 * @param app - a reference to the app.
 * @param searchFilter - a filter function to locate a route to position the new route immediatley after.
 * @param addRouteCallback - a callback that takes a router and creates the new route.
 */
export function injectRouteAfter(app, searchFilter, addRouteCallback) {
  const stack = app._router.stack

  stack.forEach(layer => {
    if (layer.name !== 'router' || !layer.handle || !layer.handle.stack) {
      return
    }

    // Find the route that we want to position out new route after.
    const newRouteIndex = layer.handle.stack.findIndex(
      route => route && route.route && searchFilter(route.route)
    )

    if (newRouteIndex !== -1) {
      // Add our new endpoint to the end of the router stack.
      addRouteCallback(layer.handle)

      const routeStack = layer.handle.stack
      const sessionRoute = routeStack[routeStack.length - 1]

      // Then we reposition it next to the route we found previously.
      layer.handle.stack = [
        ...routeStack.slice(0, newRouteIndex),
        sessionRoute,
        ...routeStack.slice(newRouteIndex, routeStack.length - 1),
      ]
    }
  })
}

export default { injectRouteAfter }

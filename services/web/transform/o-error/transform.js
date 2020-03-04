function functionArgsFilter(j, path) {
  return ['err', 'error'].includes(path.get('params').value[0].name)
}

function functionBodyProcessor(j, path) {
  // the error variable should be the first parameter to the function
  const errorVarName = path.get('params').value[0].name
  j(path)
    // look for if statements
    .find(j.IfStatement)
    .filter(path => {
      let hasReturnError = false
      j(path)
        // find returns inside the if statement where the error from
        // the args is explicitly returned
        .find(j.ReturnStatement)
        .forEach(
          path =>
            (hasReturnError =
              path.value.argument.arguments[0].name === errorVarName)
        )
      return hasReturnError
    })
    .forEach(path => {
      j(path)
        // within the selected if blocks find calls to logger
        .find(j.CallExpression, {
          callee: {
            object: { name: 'logger' }
          }
        })
        // handle logger.warn, logger.error and logger.err
        .filter(path =>
          ['warn', 'error', 'err'].includes(
            path.get('callee').get('property').value.name
          )
        )
        // replace the logger call with the constructed OError wrapper
        .replaceWith(path => {
          // extract the error message which is the second arg for logger
          const message =
            path.value.arguments.length >= 2
              ? path.value.arguments[1].value
              : 'Error'
          // create: err = new OError(...)
          return j.assignmentExpression(
            '=',
            // assign over the existing error var
            j.identifier(errorVarName),
            j.callExpression(
              j.memberExpression(
                // create: new OError
                j.newExpression(j.identifier('OError'), [
                  // create: { ... } args for new OError()
                  j.objectExpression([
                    // set message property with original error message
                    j.property(
                      'init',
                      j.identifier('message'),
                      j.literal(message)
                    ),
                    j.property(
                      'init',
                      // set info property with object { info: {} }
                      j.identifier('info'),
                      j.objectExpression(
                        // add properties from original logger info object to the
                        // OError info object, filtering out the err object itself,
                        // which is typically one of the args when doing intermediate
                        // error logging
                        // TODO: this can fail when the property name does not match
                        //       the variable name. e.g. { err: error } so need to check
                        //       both in the filter
                        path
                          .get('arguments')
                          .value[0].properties.filter(
                            property => property.key.name !== errorVarName
                          )
                      )
                    )
                  ])
                ]),
                // add: .withCause( ) to OError
                j.identifier('withCause')
              ),
              // add original error var as argument: .withCause(err)
              [j.identifier(errorVarName)]
            )
          )
        })
    })
}

export default function transformer(file, api) {
  const j = api.jscodeshift
  let source = file.source
  // apply transformer to declared functions
  source = j(source)
    .find(j.FunctionDeclaration)
    .filter(path => functionArgsFilter(j, path))
    .forEach(path => functionBodyProcessor(j, path))
    .toSource()
  // apply transformer to inline-functions
  source = j(source)
    .find(j.FunctionExpression)
    .filter(path => functionArgsFilter(j, path))
    .forEach(path => functionBodyProcessor(j, path))
    .toSource()
  // apply transformer to inline-arrow-functions
  source = j(source)
    .find(j.ArrowFunctionExpression)
    .filter(path => functionArgsFilter(j, path))
    .forEach(path => functionBodyProcessor(j, path))
    .toSource()
  // do a plain text search to see if OError is used but not imported
  if (source.includes('OError') && !source.includes('@overleaf/o-error')) {
    const root = j(source)
    // assume the first variable declaration is an import
    // TODO: this should check that there is actually a require/import here
    //       but in most cases it will be
    const imports = root.find(j.VariableDeclaration)
    const importOError = "const OError = require('@overleaf/o-error')\n"
    // if there were imports insert into list, format can re-order
    if (imports.length) {
      j(imports.at(0).get()).insertAfter(importOError)
    }
    // otherwise insert at beginning
    else {
      root.get().node.program.body.unshift(importOError)
    }
    source = root.toSource()
  }

  return source
}

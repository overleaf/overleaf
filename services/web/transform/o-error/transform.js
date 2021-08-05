function functionArgsFilter(j, path) {
  if (path.get('params') && path.get('params').value[0]) {
    return ['err', 'error'].includes(path.get('params').value[0].name)
  } else {
    return false
  }
}

function isReturningFunctionCallWithError(path, errorVarName) {
  return (
    path.value.argument &&
    path.value.argument.arguments &&
    path.value.argument.arguments[0] &&
    path.value.argument.arguments[0].name === errorVarName
  )
}

function expressionIsLoggingError(path) {
  return ['warn', 'error', 'err'].includes(
    path.get('callee').get('property').value.name
  )
}

function createTagErrorExpression(j, path, errorVarName) {
  let message = 'error'
  if (path.value.arguments.length >= 2) {
    message = path.value.arguments[1].value || message
  }

  let info
  try {
    info = j.objectExpression(
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
  } catch (error) {
    // if info retrieval fails it remains empty
  }
  const args = [j.identifier(errorVarName), j.literal(message)]
  if (info) {
    args.push(info)
  }
  return j.callExpression(
    j.memberExpression(j.identifier('OError'), j.identifier('tag')),
    args
  )
}

function functionBodyProcessor(j, path) {
  // the error variable should be the first parameter to the function
  const errorVarName = path.get('params').value[0].name
  j(path)
    .find(j.IfStatement) // look for if statements
    .filter(path =>
      j(path)
        // find returns inside the if statement where the error from
        // the args is explicitly returned
        .find(j.ReturnStatement)
        .some(path => isReturningFunctionCallWithError(path, errorVarName))
    )
    .forEach(path => {
      j(path)
        .find(j.CallExpression, {
          callee: {
            object: { name: 'logger' },
          },
        })
        .filter(path => expressionIsLoggingError(path))
        .replaceWith(path => {
          return createTagErrorExpression(j, path, errorVarName)
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

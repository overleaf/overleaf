/* eslint-disable
    max-len,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
// * An Angular service which helps with creating recursive directives.
// * @author Mark Lagendijk
// * @license MIT
//
// From: https://github.com/marklagendijk/angular-recursion
angular.module('RecursionHelper', []).factory('RecursionHelper', [
  '$compile',
  function($compile) {
    /*
    Manually compiles the element, fixing the recursion loop.
    @param element
    @param [link] A post-link function, or an object with function(s) registered via pre and post properties.
    @returns An object containing the linking functions.
    */
    return {
      compile(element, link) {
        // Normalize the link parameter
        if (angular.isFunction(link)) {
          link = { post: link }
        }

        // Break the recursion loop by removing the contents
        const contents = element.contents().remove()
        let compiledContents
        return {
          pre: link && link.pre ? link.pre : null,

          /*
        Compiles and re-adds the contents
        */
          post(scope, element) {
            // Compile the contents
            if (!compiledContents) {
              compiledContents = $compile(contents)
            }

            // Re-add the compiled contents to the element
            compiledContents(scope, function(clone) {
              element.append(clone)
            })

            // Call the post-linking function, if any
            if (link && link.post) {
              link.post.apply(null, arguments)
            }
          }
        }
      }
    }
  }
])

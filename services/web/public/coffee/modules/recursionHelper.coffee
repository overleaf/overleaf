# 
# * An Angular service which helps with creating recursive directives.
# * @author Mark Lagendijk
# * @license MIT
# 
# From: https://github.com/marklagendijk/angular-recursion
angular.module("RecursionHelper", []).factory "RecursionHelper", [
  "$compile"
  ($compile) ->
    
    ###
    Manually compiles the element, fixing the recursion loop.
    @param element
    @param [link] A post-link function, or an object with function(s) registered via pre and post properties.
    @returns An object containing the linking functions.
    ###
    return compile: (element, link) ->
      
      # Normalize the link parameter
      link = post: link  if angular.isFunction(link)
      
      # Break the recursion loop by removing the contents
      contents = element.contents().remove()
      compiledContents = undefined
      pre: (if (link and link.pre) then link.pre else null)
      
      ###
      Compiles and re-adds the contents
      ###
      post: (scope, element) ->
        
        # Compile the contents
        compiledContents = $compile(contents)  unless compiledContents
        
        # Re-add the compiled contents to the element
        compiledContents scope, (clone) ->
          element.append clone
          return

        
        # Call the post-linking function, if any
        link.post.apply null, arguments if link and link.post
        return
]
define [
  "base"
], (App) ->
  App.directive "cmEditor", () ->
    return {
      scope: {
        sharejsDoc: "="
      }

      link: (scope, element, attrs) ->
        cm = Frontend.richText.init(element.find('.cm-editor-wrapper')[0])

        scope.$watch "sharejsDoc", (sharejsDoc, oldSharejsDoc) ->
          if oldSharejsDoc?
            detachFromCM(oldSharejsDoc)
          if sharejsDoc?
            attachToCM(sharejsDoc)

        attachToCM = (sharejsDoc) ->
          setTimeout () ->
            Frontend.richText.openDoc(cm, sharejsDoc.getSnapshot())
            sharejsDoc.attachToCM(cm)

        detachFromCM = (sharejsDoc) ->
          sharejsDoc.detachFromCM()

        scope.$on 'destroy', () ->
          detachFromCM(scope.sharejsDoc)

      template: """
        <div class="cm-editor-wrapper"></div>
      """
    }
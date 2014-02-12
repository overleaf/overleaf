(function() {
  require(["jquery", "main",  "libs/google-code-prettify/prettify", "libs/google-code-prettify/latex"], function($) {
    $(document).ready(function() {
      prettyPrint();
    });
  });
}).call(this);

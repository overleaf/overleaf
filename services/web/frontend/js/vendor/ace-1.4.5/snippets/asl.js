ace.define("ace/snippets/asl",[], function (require, exports, module) {
    "use strict";

    exports.snippetText =undefined;
    exports.scope = "asl";
});
                (function() {
                    ace.require(["ace/snippets/asl"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            
ace.define("ace/snippets/slim",[], function(require, exports, module) {
    "use strict";

    exports.snippetText =undefined;
    exports.scope = "slim";

});
                (function() {
                    ace.require(["ace/snippets/slim"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            
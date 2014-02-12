(function() {
  var Settings, buildUrl, chai, expect, request;

  chai = require("chai");

  chai.should();

  expect = chai.expect;

  request = require("request");

  Settings = require("../../../app/js/Settings");

  buildUrl = function(path) {
    return "http://localhost:" + Settings.listen.port + "/" + path;
  };

  describe("Running a compile", function() {
    before(function(done) {
      var _this = this;
      return request.post({
        url: buildUrl("project/smoketest/compile"),
        json: {
          compile: {
            resources: [
              {
                path: "main.tex",
                content: "\\documentclass{article}\n\\begin{document}\nHello world\n\\end{document}"
              }
            ]
          }
        }
      }, function(error, response, body) {
        _this.error = error;
        _this.response = response;
        _this.body = body;
        return done();
      });
    });
    it("should return the pdf", function() {
      var file, _i, _len, _ref;
      _ref = this.body.compile.outputFiles;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        file = _ref[_i];
        if (file.type === "pdf") {
          return;
        }
      }
      throw new Error("no pdf returned");
    });
    return it("should return the log", function() {
      var file, _i, _len, _ref;
      _ref = this.body.compile.outputFiles;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        file = _ref[_i];
        if (file.type === "log") {
          return;
        }
      }
      throw new Error("no log returned");
    });
  });

}).call(this);

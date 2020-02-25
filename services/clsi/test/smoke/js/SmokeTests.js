/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const chai = require('chai')
if (Object.prototype.should == null) {
  chai.should()
}
const { expect } = chai
const request = require('request')
const Settings = require('settings-sharelatex')

const buildUrl = path =>
  `http://${Settings.internal.clsi.host}:${Settings.internal.clsi.port}/${path}`

const url = buildUrl(`project/smoketest-${process.pid}/compile`)

describe('Running a compile', function() {
  before(function(done) {
    return request.post(
      {
        url,
        json: {
          compile: {
            resources: [
              {
                path: 'main.tex',
                content: `\
% Membrane-like surface
% Author: Yotam Avital
\\documentclass{article}
\\usepackage{tikz}
\\usetikzlibrary{calc,fadings,decorations.pathreplacing}
\\begin{document}
\\begin{tikzpicture}
  \\def\\nuPi{3.1459265}
  \\foreach \\i in {5,4,...,2}{% This one doesn't matter
    \\foreach \\j in {3,2,...,0}{% This will crate a membrane
                               % with the front lipids visible
      % top layer
      \\pgfmathsetmacro{\\dx}{rand*0.1}% A random variance in the x coordinate
      \\pgfmathsetmacro{\\dy}{rand*0.1}% A random variance in the y coordinate,
                                     % gives a hight fill to the lipid
      \\pgfmathsetmacro{\\rot}{rand*0.1}% A random variance in the
                                      % molecule orientation      
      \\shade[ball color=red] ({\\i+\\dx+\\rot},{0.5*\\j+\\dy+0.4*sin(\\i*\\nuPi*10)}) circle(0.45);
      \\shade[ball color=gray] (\\i+\\dx,{0.5*\\j+\\dy+0.4*sin(\\i*\\nuPi*10)-0.9}) circle(0.45);
      \\shade[ball color=gray] (\\i+\\dx-\\rot,{0.5*\\j+\\dy+0.4*sin(\\i*\\nuPi*10)-1.8}) circle(0.45);
      % bottom layer
      \\pgfmathsetmacro{\\dx}{rand*0.1}
      \\pgfmathsetmacro{\\dy}{rand*0.1}
      \\pgfmathsetmacro{\\rot}{rand*0.1}
      \\shade[ball color=gray] (\\i+\\dx+\\rot,{0.5*\\j+\\dy+0.4*sin(\\i*\\nuPi*10)-2.8}) circle(0.45);
      \\shade[ball color=gray] (\\i+\\dx,{0.5*\\j+\\dy+0.4*sin(\\i*\\nuPi*10)-3.7}) circle(0.45);
      \\shade[ball color=red] (\\i+\\dx-\\rot,{0.5*\\j+\\dy+0.4*sin(\\i*\\nuPi*10)-4.6}) circle(0.45);
    }
  }
\\end{tikzpicture}
\\end{document}\
`
              }
            ]
          }
        }
      },
      (error, response, body) => {
        this.error = error
        this.response = response
        this.body = body
        return done()
      }
    )
  })

  it('should return the pdf', function() {
    for (const file of Array.from(this.body.compile.outputFiles)) {
      if (file.type === 'pdf') {
        return
      }
    }
    throw new Error('no pdf returned')
  })

  return it('should return the log', function() {
    for (const file of Array.from(this.body.compile.outputFiles)) {
      if (file.type === 'log') {
        return
      }
    }
    throw new Error('no log returned')
  })
})

var CodeScorer = require('./CodeScorer');
var ProblemView = require('./ProblemView');
var SetupView = require('./SetupView');

var container = document.createElement('div');
container.className = 'container';
document.body.appendChild(container);

/*
var problem = 'Implement the function <i>sumEven</i> which for a given integer <i>n</i> returns the sum of all positive <i>even</i> integers less than <i>n</i>.';
var examples = [
    'If <i>n</i> = 7, then <i>sumEven</i> should return 12, since 2 + 4 + 6 = 12',
    'If <i>n</i> = 11, then <i>sumEven</i> should return 30, since 2 + 4 + 6 + 8 + 10 = 30'
];
var problemView = new ProblemView(problem, examples);
container.appendChild(problemView.el);

problemView.on('next', function () {
    console.log('next');
});
*/

var setupViewEl = document.createElement('div');
document.body.appendChild(setupViewEl);
var setupView = new SetupView(setupViewEl);

setupView.on('next', function (setup) {
    console.dir(setup);
});

/*
var el = document.createElement('div');
document.body.appendChild(el);
var scorer = new CodeScorer(el);

scorer.setPlayer({
    nickname:'martinvl',
    email:'martinvl@student.matnat.uio.no'
});
scorer.setLanguage('java');
scorer.setEditorStyle('vim');
*/

var CodeScorer = require('./CodeScorer');
var ProblemView = require('./ProblemView');
var SetupView = require('./SetupView');

var container = document.createElement('div');
container.className = 'container';
document.body.appendChild(container);

// --- Setup SetupView ---
var setupView = new SetupView();

// --- Setup ProblemView ---
var problem = 'Implement the function <i>sumEven</i> which for a given integer <i>n</i> returns the sum of all positive <i>even</i> integers less than <i>n</i>.';
var examples = [
    'If <i>n</i> = 7, then <i>sumEven</i> should return 12, since 2 + 4 + 6 = 12',
    'If <i>n</i> = 11, then <i>sumEven</i> should return 30, since 2 + 4 + 6 + 8 + 10 = 30'
];
var problemView = new ProblemView(problem, examples);

var el = document.createElement('div');
var submissionView = new CodeScorer(el);

// --- Setup event handling ---
setupView.on('next', function (setup) {
    submissionView.setLanguage(setup.language);
    submissionView.setEditorStyle(setup.editor);
    submissionView.setPlayer({
        nickname:setup.nickname,
        email:setup.email
    });

    setSetupViewVisible(false);
    setProblemViewVisible(true);
});

problemView.on('next', function () {
    setProblemViewVisible(false);
    setSubmissionViewVisible(true);
});

setSetupViewVisible(true);

function setSetupViewVisible(visible) {
    if (visible) {
        container.appendChild(setupView.el);
        setupView.focus();
    } else {
        container.removeChild(setupView.el);
    }
}

function setProblemViewVisible(visible) {
    if (visible) {
        container.appendChild(problemView.el);
    } else {
        container.removeChild(problemView.el);
    }
}

function setSubmissionViewVisible(visible) {
    if (visible) {
        container.appendChild(submissionView.el);
        submissionView.refresh();
        submissionView.focus();
    } else {
        container.removeChild(submissionView.el);
    }
}

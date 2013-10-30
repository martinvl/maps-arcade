var io = require('socket.io-client');
var CodeScorer = require('./CodeScorer');
var ProblemView = require('./ProblemView');
var SetupView = require('./SetupView');
var StatusView = require('./StatusView');

var PROBLEM1 = {
    ID:'problem1',
    timeout:60,
    pythonDefault:'def sum_even(n):',
    javaDefault:'public static long sumEven(long n) {\n}',
    cDefault:'long sum_even(long n)\n{\n}',
    description:'Implement the function <i>sumEven</i> which for a given integer <i>n</i> returns the sum of all positive <i>even</i> integers less than <i>n</i>.',
    definition:'<i>sumEven</i> should return the sum of all positive <i>even</i> integers less than <i>n</i>.',
    examples:[
        'If <i>n</i> = 7, then <i>sumEven</i> should return 12, since 2 + 4 + 6 = 12',
        'If <i>n</i> = 11, then <i>sumEven</i> should return 30, since 2 + 4 + 6 + 8 + 10 = 30'
    ]
};

var PROBLEM2 = {
    ID:'problem2',
    timeout:180,
    pythonDefault:'def get_index(numbers, k):',
    javaDefault:'public static int getIndex(int[] numbers, int k) {\n}',
    cDefault:'int get_index(int numbers[], size_t N, int k)\n{\n}',
    description:'Implement the function <i>getIndex</i> which for a given array of ascending numbers, and an integer <i>k</i>, returns the index of <i>k</i> in <i>numbers</i>.',
    definition:'<i>getIndex</i> should return the index of <i>k</i> in <i>numbers</i>.',
    examples:[
        'If <i>numbers</i> = [0, 1, 2, 3], and <i>k</i> = 2, then <i>getIndex</i> should return 2.',
        'If <i>numbers</i> = [2, 4, 6, 8], and <i>k</i> = 4, then <i>getIndex</i> should return 1.'
    ]
};

var container = document.createElement('div');
container.className = 'container';
document.body.appendChild(container);

// --- Setup SetupView ---
var setupView = new SetupView();

// --- Setup ProblemView ---
var problemView = new ProblemView(PROBLEM2.description, PROBLEM2.examples);
var submissionView = new CodeScorer(PROBLEM2);

// --- Setup StatusView ---
var statusView = new StatusView();

// --- Setup connection ---
var socket = io.connect('/');

socket.on('connect', function () {
    console.log('Connected to server');
});

// --- Setup event handling ---
setupView.on('next', function (setup) {
    socket.emit('email', setup.email);

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

submissionView.on('result', function (result) {
    if (result.accepted) {
        statusView.setTitle('Accepted');
        statusView.setSuccess(true);

        var scores = [
            result.impTime + ' implementation time',
            result.runTime + ' running time',
            result.codeSize + ' characters',
            formatStanding(result.rank) + ' place (currently)'
            ];
        statusView.setScores(scores);
    } else {
        statusView.setTitle('Timeout');
        statusView.setSuccess(false);
    }

    setTimeout(function () {
        setSubmissionViewVisible(false);
        setStatusViewVisible(true);

        setTimeout(function () {
            reset();
        }, 7000);
    }, 2000);
});

reset();

function setSetupViewVisible(visible) {
    if (visible) {
        container.appendChild(setupView.el);
        setupView.focus();
    } else {
        try {
            container.removeChild(setupView.el);
        } catch (e) {}
    }
}

function setProblemViewVisible(visible) {
    if (visible) {
        container.appendChild(problemView.el);
    } else {
        try {
            container.removeChild(problemView.el);
        } catch (e) {}
    }
}

function setSubmissionViewVisible(visible) {
    if (visible) {
        container.appendChild(submissionView.el);
        submissionView.refresh();
        submissionView.focus();
    } else {
        try {
            container.removeChild(submissionView.el);
        } catch (e) {}
    }
}

function setStatusViewVisible(visible) {
    if (visible) {
        container.appendChild(statusView.el);
    } else {
        try {
            container.removeChild(statusView.el);
        } catch (e) {}
    }
}

function formatStanding(standing) {
    switch (standing % 10) {
        case 1:
            standing += 'st';
            break;
        case 2:
            standing += 'nd';
            break;
        case 3:
            standing += 'rd';
            break;
        default:
            standing += 'th';
            break;
    }

    return standing;
}

function reset() {
    setSetupViewVisible(false);
    setProblemViewVisible(false);
    setSubmissionViewVisible(false);
    setStatusViewVisible(false);

    setupView.reset();
    submissionView.reset();
    statusView.reset();

    setSetupViewVisible(true);
}

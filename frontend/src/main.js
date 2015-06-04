var io = require('socket.io-client');
var CodeScorer = require('./CodeScorer');
var ProblemView = require('./ProblemView');
var SetupView = require('./SetupView');
var StatusView = require('./StatusView');
var $ = require('jquery');

var container = document.createElement('div');
container.className = 'container';
document.body.appendChild(container);

// --- Setup SetupView ---
var setupView = new SetupView();

// --- Load problem and setup ProblemView ---
var problemView;
var submissionView;

$.getJSON('/problem', function (data) {
    problemView = new ProblemView(data.description, data.examples);
    submissionView = new CodeScorer(data);

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
});

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
        nickname: setup.nickname,
        email:    setup.email
    });

    setSetupViewVisible(false);
    setProblemViewVisible(true);
});


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

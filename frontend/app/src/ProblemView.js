var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');

function ProblemView(problem, examples) {
    this.problem = problem || '';
    this.examples = examples || [];

    this.setup();
}

inherits(ProblemView, EventEmitter);
module.exports = ProblemView;

ProblemView.prototype.setup = function () {
    this.el = document.createElement('div');
    this.el.className = 'big_box centered_container';

    this.setupHeader();
    this.setupProblem();
    this.setupExamples();
    this.setupNextButton();
};

ProblemView.prototype.setupHeader = function () {
    this.header = document.createElement('h1');
    this.header.innerHTML = 'Problem';
    this.el.appendChild(this.header);
};

ProblemView.prototype.setupProblem = function () {
    this.problemView = document.createElement('div');
    this.problemView.className = 'info';
    this.problemView.innerHTML = this.problem;
    this.el.appendChild(this.problemView);
};

ProblemView.prototype.setupExamples = function () {
    this.exampleViews = [];

    for (var idx in this.examples) {
        var exampleView = document.createElement('div');
        exampleView.className = 'info';
        exampleView.innerHTML = this.examples[idx];

        this.exampleViews.push(exampleView);
        this.el.appendChild(exampleView);
    }
};

ProblemView.prototype.setupNextButton = function () {
    var button = document.createElement('div');
    button.className = 'button wide';
    button.innerHTML = 'Next';
    this.el.appendChild(button);

    var self = this;
    button.onclick = function () {
        self.emit('next');
    };
};

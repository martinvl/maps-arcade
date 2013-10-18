var ScoreView = require('./ScoreView');

function ScoreboardView() {
    this.setup();
    this.reset();
}

module.exports = ScoreboardView;

ScoreboardView.prototype.setup = function () {
    this.el = document.createElement('div');
    this.el.className = 'scoreboard';
};

ScoreboardView.prototype.setScores = function (scores) {
    this.reset();

    for (var idx in scores) {
        var scoreView = new ScoreView();
        scoreView.setScore(scores[idx]);

        this.el.appendChild(scoreView.el);
        this.scoreViews.push(scoreView);
    }
};

ScoreboardView.prototype.reset = function () {
    for (var idx in this.scoreViews) {
        this.el.removeChild(this.scoreViews[idx].el);
    }

    this.scoreViews = [];
};

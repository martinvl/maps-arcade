var ScoreView = require('./ScoreView');

function ScoreboardView(title) {
    this.title = title;
    this.setup();
    this.reset();
}

module.exports = ScoreboardView;

ScoreboardView.prototype.setup = function () {
    this.el = document.createElement('div');
    this.el.className = 'scoreboard';

    var title = document.createElement('div');
    title.className = 'title';
    title.innerHTML = this.title;
    this.el.appendChild(title);

    var legend = document.createElement('div');
    legend.className = 'legend';
    this.el.appendChild(legend);

    var rankBox = document.createElement('div');
    rankBox.className = 'legend_box rank';
    rankBox.innerHTML = '#';
    legend.appendChild(rankBox);

    var nameBox = document.createElement('div');
    nameBox.className = 'legend_box name';
    nameBox.innerHTML = 'Nickname';
    legend.appendChild(nameBox);

    var languageBox = document.createElement('div');
    languageBox.className = 'legend_box language';
    languageBox.innerHTML = 'Language';
    legend.appendChild(languageBox);

    var impTimeBox = document.createElement('div');
    impTimeBox.className = 'legend_box imp_time';
    impTimeBox.innerHTML = 'Code time';
    legend.appendChild(impTimeBox);

    var runTimeBox = document.createElement('div');
    runTimeBox.className = 'legend_box run_time';
    runTimeBox.innerHTML = 'Run time';
    legend.appendChild(runTimeBox);

    var codeSizeBox = document.createElement('div');
    codeSizeBox.className = 'legend_box code_size';
    codeSizeBox.innerHTML = 'Code size';
    legend.appendChild(codeSizeBox);
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

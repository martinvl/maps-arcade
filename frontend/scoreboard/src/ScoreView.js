function ScoreView() {
    this.setup();
}

module.exports = ScoreView;

ScoreView.prototype.setup = function () {
    this.el = document.createElement('div');
    this.el.className = 'score';

    this.rankField = document.createElement('div');
    this.rankField.className = 'score_box rank';
    this.el.appendChild(this.rankField);

    this.nameField = document.createElement('div');
    this.nameField.className = 'score_box name';
    this.el.appendChild(this.nameField);

    this.languageField = document.createElement('div');
    this.languageField.className = 'score_box language';
    this.el.appendChild(this.languageField);

    this.impTimeField = document.createElement('div');
    this.impTimeField.className = 'score_box imp_time';
    this.el.appendChild(this.impTimeField);

    this.runTimeField = document.createElement('div');
    this.runTimeField.className = 'score_box run_time';
    this.el.appendChild(this.runTimeField);

    this.codeSizeField = document.createElement('div');
    this.codeSizeField.className = 'score_box code_size';
    this.el.appendChild(this.codeSizeField);
};

ScoreView.prototype.setScore = function (score) {
    this.rankField.innerHTML = score.rank || '';
    this.nameField.innerHTML = score.name || '';
    this.languageField.innerHTML = score.language || '';
    this.impTimeField.innerHTML = score.impTime || '';
    this.runTimeField.innerHTML = score.runTime || '';
    this.codeSizeField.innerHTML = score.codeSize || '';
};

ScoreView.prototype.setHighlighted = function (highlighted) {
    this.el.className = 'score' + (highlighted ? ' highlighted' : '');
};

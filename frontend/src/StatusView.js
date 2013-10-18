function StatusView() {
    this.setup();
}

module.exports = StatusView;

StatusView.prototype.setup = function () {
    this.el = document.createElement('div');
    this.el.className = 'big_box centered_container';

    this.setupHeader();
    this.reset();
};

StatusView.prototype.setupHeader = function () {
    this.header = document.createElement('h1');
    this.el.appendChild(this.header);
};

StatusView.prototype.setTitle = function (title) {
    this.header.innerHTML = title || '';
};

StatusView.prototype.setSuccess = function (success) {
    this.header.className = 'top ' + (success ? 'green' : 'red bottom');
};

StatusView.prototype.setScores = function (scores) {
    this.resetScores();

    for (var i = 0; i < scores.length; ++i) {
        var scoreView = document.createElement('div');
        scoreView.innerHTML = scores[i];

        if (i == scores.length-1) {
            scoreView.className = 'info_part bottom selected';
        } else {
            scoreView.className = 'info_part middle';
        }

        this.scoreViews.push(scoreView);
        this.el.appendChild(scoreView);
    }
};

StatusView.prototype.reset = function () {
    this.setTitle('');
    this.setSuccess(false);
    this.resetScores();
};

StatusView.prototype.resetScores = function () {
    for (var idx in this.scoreViews) {
        this.el.removeChild(this.scoreViews[idx]);
    }

    this.scoreViews = [];
};

function EvalstatusView() {
    this.setup();
    this.reset();
}

module.exports = EvalstatusView;

EvalstatusView.prototype.setup = function () {
    this.el = document.createElement('div');
    this.el.className = 'evalstatus';
};

EvalstatusView.prototype.setStatus = function (evalstatus) {
    var total=0, free=0, nodes=0;
    for (var idx in evalstatus) {
        var host = evalstatus[idx];
        nodes++;
        free += host.cur;
        total += host.max;
    }
    this.el.innerHTML = 'Eval servers: '+nodes+', idle slots: '+free+', number of slots: '+total;
};

EvalstatusView.prototype.reset = function () {
    this.setStatus({});
};

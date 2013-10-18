var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');

var TIMER_INTERVAL = 30 / 1000;

function TimerView(countdown) {
    this.countdown = countdown || 0;

    this.setup();
    this.reset();
}

inherits(TimerView, EventEmitter);
module.exports = TimerView;

TimerView.prototype.setup = function () {
    this.el = document.createElement('div');
};

TimerView.prototype.reset = function () {
    this.timer = {
        running:false,
        started:false,
        start:0,
        end:0
    };

    this.updateTimerText();
};

TimerView.prototype.startTimer = function () {
    if (!this.timer.started) {
        this.timer.start = new Date();
    }

    this.timer.started = true;
    this.continueTimer();
};

TimerView.prototype.continueTimer = function () {
    if (this.timer.running || !this.timer.started) {
        return;
    }

    var self = this;
    this.timer.interval = setInterval(function () {
        self.timerTick();
    }, TIMER_INTERVAL);

    this.timer.running = true;
    this.timerTick();
};

TimerView.prototype.stopTimer = function () {
    if (!this.timer.running) {
        return;
    }

    this.timer.end = new Date();
    this.timer.running = false;
    clearInterval(this.timer.interval);

    this.updateTimerText();
};

TimerView.prototype.timerTick = function () {
    if (this.timer.running && !this.timerValid()) {
        this.stopTimer();
        this.timer.end = new Date(this.timer.start.valueOf() + this.countdown*1000);

        this.emit('timeout');
    }

    this.updateTimerText();
};

TimerView.prototype.timerValid = function () {
    return this.getTime() < this.countdown;
};

TimerView.prototype.updateTimerText = function () {
    this.el.innerHTML = this.getFormattedCountdownTime();
    this.el.className = 'timer' + (this.timerValid() ? '' : ' invalid');
};

TimerView.prototype.getTime = function () {
    var end = this.timer.running ? new Date() : this.timer.end;

    return (end - this.timer.start) / 1000;
};

TimerView.prototype.getCountdownTime = function () {
    return this.countdown - this.getTime();
};

TimerView.prototype.getFormattedTime = function () {
    return formatTime(this.getTime());
};

TimerView.prototype.getFormattedCountdownTime = function () {
    return formatTime(this.getCountdownTime());
};

function formatTime(time) {
    var formattedTime = '';

    time = Math.round(time*100)/100;

    if (time == Math.round(time)) {
        formattedTime = time + '.00s';
    } else if (time == Math.round(time*10)/10) {
        formattedTime = time + '0s';
    } else {
        formattedTime = time + 's';
    }

    return formattedTime;
}

var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');

function SelectOptionView(title, position) {
    this.title = title;
    this.position = position;

    this.setup();
}

inherits(SelectOptionView, EventEmitter);
module.exports = SelectOptionView;

SelectOptionView.prototype.setup = function () {
    this.el = document.createElement('div');
    this.el.className = 'select ' + this.position;
    this.el.innerHTML = this.title;

    var self = this;
    this.el.onclick = function () {
        self.emit('click');
    };
};

SelectOptionView.prototype.setSelected = function (selected) {
    this.el.className = 'select ' + this.position + (selected ? ' selected' : '');
};

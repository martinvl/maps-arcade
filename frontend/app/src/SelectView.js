var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var SelectOptionView = require('./SelectOptionView');

function SelectView(title, options) {
    this.title = title;
    this.options = options;
    this.setup();

    this.reset();
}

inherits(SelectView, EventEmitter);
module.exports = SelectView;

SelectView.prototype.setup = function () {
    this.el = document.createElement('div');
    this.el.className = 'select_box';

    this.header = document.createElement('h3');
    this.header.innerHTML = this.title;
    this.el.appendChild(this.header);

    this.optionViews = [];

    for (var i = 0; i < this.options.length; ++i) {
        var position;
        switch (i) {
            case 0:
                position = 'top';
                break;
            case this.options.length-1:
                position = 'bottom';
                break;
            default:
                position = 'middle';
                break;
        }

        var optionView = new SelectOptionView(this.options[i], position);
        optionView.index = i;

        var self = this;
        optionView.on('click', function () {
            self.selectOption(this.index);
        });

        this.el.appendChild(optionView.el);
        this.optionViews.push(optionView);
    }
};

SelectView.prototype.reset = function () {
    this.selectOption(0);
};

SelectView.prototype.selectOption = function (selectedIndex) {
    this.selectedOption = selectedIndex;
    this.emit('select', this.selectedOption);

    for (var idx in this.optionViews) {
        this.optionViews[idx].setSelected(idx == selectedIndex);
    }
};

SelectView.prototype.getSelection = function () {
    return this.selectedOption;
};

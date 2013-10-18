var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var SelectView = require('./SelectView');

function SetupView(el) {
    this.el = el;
    this.setup();
}

inherits(SetupView, EventEmitter);
module.exports = SetupView;

SetupView.prototype.setup = function () {
    this.el.className = 'big_box';
    this.el.style.height = '300px'; // XXX

    var header = document.createElement('h1');
    header.innerHTML = 'Setup';
    this.el.appendChild(header);

    this.setupPlayerFields();
    this.el.appendChild(this.nicknameField);
    this.el.appendChild(this.emailField);

    this.setupSelect();
    this.languageSelectView.selectOption(0);
    this.editorSelectView.selectOption(0);

    this.setupSubmitButton();
    this.el.appendChild(this.submitButton);
};

SetupView.prototype.setupPlayerFields = function () {
    this.nicknameField = document.createElement('input');
    this.nicknameField.className = 'top';
    this.nicknameField.type = 'text';
    this.nicknameField.placeholder = 'Enter nickname';

    this.emailField = document.createElement('input');
    this.emailField.className = 'bottom';
    this.emailField.type = 'text';
    this.emailField.placeholder = 'Enter e-mail';
};

SetupView.prototype.setupSelect = function () {
    var container = document.createElement('div');
    this.el.appendChild(container);

    this.languageSelectView = new SelectView('Language', ['C', 'Java', 'Python']);
    container.appendChild(this.languageSelectView.el);

    this.editorSelectView = new SelectView('Editor', ['Basic', 'Vim style', 'Emacs style']);
    container.appendChild(this.editorSelectView.el);
};

SetupView.prototype.setupSubmitButton = function () {
    this.submitButton = document.createElement('div');
    this.submitButton.className = 'button wide';
    this.submitButton.innerHTML = 'Next';

    var self = this;
    this.submitButton.onclick = function () {
        self.emit('next', self.getSetup());
    };
};

SetupView.prototype.getSetup = function () {
    var editor;
    switch (this.editorSelectView.getSelection()) {
        case 0:
            editor = 'basic';
            break;
        case 2:
            editor = 'emacs';
            break;
        case 1:
        default:
            editor = 'vim';
            break;
    }

    var language;
    switch (this.languageSelectView.getSelection()) {
        case 0:
            language = 'c';
            break;
        case 2:
            language = 'python';
            break;
        case 1:
        default:
            language = 'java';
            break;
    }

    var setup = {
        nickname:this.nicknameField.value,
        email:this.emailField.value,
        editor:editor,
        language:language
    };

    return setup;
};

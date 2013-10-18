var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var SelectView = require('./SelectView');

function SetupView() {
    this.setup();
}

inherits(SetupView, EventEmitter);
module.exports = SetupView;

SetupView.prototype.setup = function () {
    this.el = document.createElement('div');
    this.el.className = 'big_box centered_container';

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

    var self = this;
    this.nicknameField.onkeyup = function () {
        self.showNeedsNickname();
    };

    this.emailField.onkeyup = function () {
        self.showNeedsEmail();
    };
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
        self.submit();
    };
};

SetupView.prototype.submit = function () {
    this.showNeedsInput();

    if (this.inputValid()) {
        this.emit('next', this.getSetup());
    }
};

SetupView.prototype.nicknameValid = function () {
    return this.nicknameField.value.length > 0;
};

SetupView.prototype.emailValid = function () {
    return this.emailField.value.length > 0;
};

SetupView.prototype.inputValid = function () {
    return this.nicknameValid() && this.emailValid();
};

SetupView.prototype.showNeedsNickname = function () {
    this.nicknameField.className = 'top' + (this.nicknameValid() ? '' : ' invalid');
};

SetupView.prototype.showNeedsEmail = function () {
    this.emailField.className = 'bottom' + (this.emailValid() ? '' : ' invalid');
};

SetupView.prototype.showNeedsInput = function () {
    this.showNeedsNickname();
    this.showNeedsEmail();
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

SetupView.prototype.reset = function () {
    this.nicknameField.value = '';
    this.emailField.value = '';
    this.languageSelectView.reset();
    this.editorSelectView.reset();
};

SetupView.prototype.focus = function () {
    this.nicknameField.focus();
};

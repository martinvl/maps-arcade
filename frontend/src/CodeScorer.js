var io = require('socket.io-client');
var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var CodeMirror = require('codemirror');
require('codemirror/mode/python/python.js');
require('codemirror/mode/clike/clike.js');
require('codemirror/addon/edit/closebrackets.js');
require('codemirror/keymap/vim.js');
require('codemirror/keymap/emacs.js');

var TimerView = require('./TimerView');

function CodeScorer(problem) {
    this.problem = problem;

    this.setup();
    this.reset();
}

inherits(CodeScorer, EventEmitter);
module.exports = CodeScorer;

// ----- Setup -----
CodeScorer.prototype.setup = function () {
    this.hasStartedCoding = false;

    this.el = document.createElement('div');
    this.el.className = 'big_box wide centered_container';

    this.setupTimerView();
    this.setupCharCountField();
    this.el.appendChild(createClear());
    this.setupEditor();
    this.setupSubmitButton();
    this.setupStatus();

    this.setupConnection();
};

CodeScorer.prototype.setupTimerView = function () {
    this.timerView = new TimerView(this.problem.codingTimeout);
    this.el.appendChild(this.timerView.el);

    var self = this;
    this.timerView.on('timeout', function () {
        //self.timeout();
    });
};

CodeScorer.prototype.setupCharCountField = function () {
    this.charCountField = document.createElement('div');
    this.charCountField.className = 'char_count';

    this.el.appendChild(this.charCountField);
};

CodeScorer.prototype.setupEditor = function () {
    this.editorContainer = document.createElement('div');
    this.editorContainer.className = 'editor_container';
    this.el.appendChild(this.editorContainer);

    this.editor = CodeMirror(this.editorContainer, {
        indentUnit:4,
        indenWithTabs:false,
        smartIndent:true,
        electricChars:true,
        lineNumbers:true,
        autofocus:true,
        autoCloseBrackets:true,
        theme:'base16-dark'
    });

    var self = this;
    this.editor.save = function () {
        self.submit();
    };

    this.editor.on('change', function (ed, obj) {
        self.updateCharCount();

        var isInputChange = (obj.origin == '+input' || obj.origin == '-input');

        if (isInputChange && !self.hasStartedCoding) {
            self.hasStartedCoding = true;
            self.timerView.startTimer();
        }
    });
};

CodeScorer.prototype.setupSubmitButton = function () {
    this.submitButton = document.createElement('div');
    this.submitButton.className = 'button wide';
    this.submitButton.innerHTML = 'Submit';

    var self = this;
    this.submitButton.onclick = function () {
        self.submit();
    };

    this.el.appendChild(this.submitButton);
};

CodeScorer.prototype.setupStatus = function () {
    this.statusContainer = document.createElement('div');
    this.statusContainer.id = 'status_container';

    this.setupInfoView();
    this.setupStatusView();

    this.statusContainer.appendChild(this.infoView);
    this.statusContainer.appendChild(this.statusView);
    this.statusContainer.appendChild(createClear());

    this.el.appendChild(this.statusContainer);
};

CodeScorer.prototype.setupInfoView = function () {
    this.infoView = document.createElement('div');
    this.infoView.className = 'status_container';

    var header = document.createElement('h3');
    header.innerHTML = 'Info';
    this.infoView.appendChild(header);

    var infoBox = document.createElement('div');
    infoBox.className = 'info';
    infoBox.innerHTML = this.problem.definition;
    this.infoView.appendChild(infoBox);
};

CodeScorer.prototype.setupStatusView = function () {
    this.statusView = document.createElement('div');
    this.statusView.className = 'status_container';

    var header = document.createElement('h3');
    header.innerHTML = 'Status';
    this.statusView.appendChild(header);

    var submissionField = document.createElement('div');
    submissionField.className = 'info';
    this.statusIndicator = document.createElement('div');
    this.statusBox = document.createElement('div');
    this.statusBox.innerHTML = '';
    submissionField.appendChild(this.statusIndicator);
    submissionField.appendChild(this.statusBox);
    this.resetStatus();
    this.statusView.appendChild(submissionField);
};

// ----- Setters -----
CodeScorer.prototype.setPlayer = function (player) {
    this.player = player || {};
    this.sendHandshake();
};

CodeScorer.prototype.setLanguage = function (language) {
    this.language = language;

    var mode, defaultCode, languageName;
    switch (language) {
        case 'python':
            mode = 'python';
            languageName = 'Python';
            defaultCode = this.problem.pythonDefault;
            break;
        case 'c':
            mode = 'text/x-csrc';
            languageName = 'C';
            defaultCode = this.problem.cDefault;
            break;
        case 'java':
        default:
            mode = 'text/x-java';
            languageName = 'Java';
            defaultCode = this.problem.javaDefault;
            break;
    }

    this.editor.setOption('mode', mode);
    this.editor.setValue(defaultCode);
};

CodeScorer.prototype.setEditorStyle = function (editorStyle) {
    var keyMap, editorName;
    switch (editorStyle) {
        case 'emacs':
            keyMap = 'emacs';
            editorName = 'Emacs';
            break;
        case 'basic':
            keyMap = 'default';
            editorName = 'Basic';
            break;
        case 'vim':
        default:
            keyMap = 'vim';
            editorName = 'Vim';
            break;
    }

    this.editor.setOption('keyMap', keyMap);
    this.editor.setOption('vimMode', editorStyle === 'vim');
};

CodeScorer.prototype.reset = function () {
    this.timerView.reset();
    this.setLocked(false);

    this.setPlayer();
    this.setLanguage();
    this.setEditorStyle();
    this.resetStatus();

    this.hasStartedCoding = false;
};

CodeScorer.prototype.focus = function () {
    this.editor.focus();
};

CodeScorer.prototype.refresh = function () {
    this.editor.refresh();
};

CodeScorer.prototype.resetStatus = function () {
    this.updateIndicator('idle', 'Idle');
};

// ----- State handling -----
CodeScorer.prototype.timeout = function () {
    this.setLocked(true);
    this.emit('result', {timeout:true});
};

CodeScorer.prototype.currentCharCount = function () {
    return this.editor.getValue().replace(/\s/g, '').length;
};

CodeScorer.prototype.updateCharCount = function () {
    this.charCountField.innerHTML = this.currentCharCount();
};

CodeScorer.prototype.submit = function () {
    this.setLocked(true);

    this.sendCodeBody();
};

CodeScorer.prototype.setLocked = function (locked) {
    if (locked) {
        this.timerView.stopTimer();
        this.editor.setOption('readOnly', 'nocursor');
    } else {
        this.timerView.continueTimer();
        this.editor.setOption('readOnly', false);
        this.editor.focus();
    }
};

// ----- Connection stuff -----
CodeScorer.prototype.setupConnection = function () {
    this.socket = io.connect('/');

    this.socket.on('connect', function () {
        console.log('Connected to server');
    });

    var self = this;
    this.socket.on('status', function (payload) {
        self.updateIndicator(payload.status, payload.message);
    });

    this.socket.on('result', function (result) {
        if (result.accepted) {
            self.emit('result', result);
        } else {
            self.setLocked(false);
        }
    });
};

CodeScorer.prototype.sendHandshake = function () {
    if (this.player.nickname) {
        this.socket.emit('handshake', {name:this.player.nickname});
    }
};

CodeScorer.prototype.sendCodeBody = function () {
    this.socket.emit('evaluate', {
        problemID: this.problem.id,
        language: this.language,
        impTime:  this.timerView.getTime(),
        // These spaces are invisible and make compiler errors. Annoying!
        codeBody: this.editor.getValue().replace(/\xa0/g, ' ')
    });
};

CodeScorer.prototype.updateIndicator = function(mode, text) {
    var className = 'status_light ';

    // Should produce errors too
    className += {idle: 'gray', success: 'green', pending: 'yellow', failed: 'red'}[mode];

    this.statusIndicator.className = className;

    this.statusBox.innerHTML = text.replace(/\n/g, '<br />\n');
}

function createClear() {
    var el = document.createElement('div');
    el.style.clear = 'both';

    return el;
}

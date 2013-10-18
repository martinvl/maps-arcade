var CodeMirror = require('code-mirror');
require('code-mirror/mode/python.js');
require('code-mirror/mode/clike.js');
require('code-mirror/addon/edit/closebrackets.js');
require('code-mirror/keymap/vim.js');
require('code-mirror/keymap/emacs.js');

var io = require('socket.io-client');

var PYTHON_DEFAULT = 'def sum_even(n):';
var C_DEFAULT = 'long sumEven(long n)\n{\n}';
var JAVA_DEFAULT = 'public long sumEven(long n) {\n}';
var TIMER_INTERVAL = 30 / 1000;

function CodeScorer(el) {
    this.el = el;
    this.setup();
    this.reset();
}

module.exports = CodeScorer;

// ----- Setup -----
CodeScorer.prototype.setup = function () {
    this.setupEl();
    this.setupTimer();
    this.setupConnection();
};

CodeScorer.prototype.setupEl = function () {
    this.el.className = 'big_box wide centered_container';

    this.setupTimerField();
    this.setupCharCountField();
    this.el.appendChild(this.timerField);
    this.el.appendChild(this.charCountField);
    this.el.appendChild(createClear());

    this.setupEditor();

    this.setupSubmitButton();
    this.el.appendChild(this.submitButton);

    this.setupStatus();
    this.el.appendChild(this.statusContainer);
};

CodeScorer.prototype.setupTimerField = function () {
    this.timerField = document.createElement('div');
    this.timerField.className = 'timer';
    this.timerField.innerHTML = '00.00s'; // XXX
};

CodeScorer.prototype.setupCharCountField = function () {
    this.charCountField = document.createElement('div');
    this.charCountField.className = 'char_count';
    this.charCountField.innerHTML = '60'; // XXX
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
        value:'public static void main(String[] args) {\n}',
        keyMap:'vim',
        mode:'text/x-java',
        theme:'base16-dark'
    });

    var self = this;
    this.editor.save = function () {
        self.submit();
    };

    this.editor.on('change', function (ed, obj) {
        self.updateCharCount();

        var isInputChange = (obj.origin == '+input' || obj.origin == '-input');

        if (isInputChange && !self.timer.running) {
            self.startTimer();
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
};

CodeScorer.prototype.setupStatus = function () {
    this.statusContainer = document.createElement('div');
    this.statusContainer.id = 'status_container';

    this.setupInfoView();
    this.setupConfigView();
    this.setupStatusView();

    this.statusContainer.appendChild(this.infoView);
    this.statusContainer.appendChild(this.configView);
    this.statusContainer.appendChild(this.statusView);
    this.statusContainer.appendChild(createClear());
};

CodeScorer.prototype.setupInfoView = function () {
    this.infoView = document.createElement('div');
    this.infoView.className = 'status_container';

    var header = document.createElement('h3');
    header.innerHTML = 'Info';
    this.infoView.appendChild(header);

    var infoBox = document.createElement('div');
    infoBox.className = 'info';
    infoBox.id = 'info_box';
    infoBox.innerHTML = '<i>sumEven</i> should return the sum of all positive <i>even</i> integers less than <i>n</i>.'; // XXX
    this.infoView.appendChild(infoBox);
};

CodeScorer.prototype.setupConfigView = function () {
    this.configView = document.createElement('div');
    this.configView.className = 'status_container';

    var header = document.createElement('h3');
    header.innerHTML = 'Config';
    this.configView.appendChild(header);

    this.nicknameField = document.createElement('div');
    this.nicknameField.className = 'info_part top';
    this.nicknameField.style.textAlign = 'center'; // XXX
    this.nicknameField.innerHTML = 'martinvl'; // XXX
    this.configView.appendChild(this.nicknameField);

    this.languageField = document.createElement('div');
    this.languageField.className = 'info_part middle';
    this.languageField.style.textAlign = 'center'; // XXX
    this.languageField.innerHTML = 'Java'; // XXX
    this.configView.appendChild(this.languageField);

    this.editorStyleField = document.createElement('div');
    this.editorStyleField.className = 'info_part bottom';
    this.editorStyleField.style.textAlign = 'center'; // XXX
    this.editorStyleField.innerHTML = 'Vim'; // XXX
    this.configView.appendChild(this.editorStyleField);
};

CodeScorer.prototype.setupStatusView = function () {
    this.statusView = document.createElement('div');
    this.statusView.className = 'status_container';

    var header = document.createElement('h3');
    header.innerHTML = 'Status';
    this.statusView.appendChild(header);

    var submissionField = document.createElement('div');
    submissionField.className = 'info_part top';
    this.submissionIndicator = document.createElement('div');
    updateIndicator(this.submissionIndicator, 'failed');
    submissionField.appendChild(this.submissionIndicator);
    submissionField.appendChild(document.createTextNode('Submission'));
    this.statusView.appendChild(submissionField);

    var compilationField = document.createElement('div');
    compilationField.className = 'info_part middle';
    this.compilationIndicator = document.createElement('div');
    updateIndicator(this.compilationIndicator, 'failed');
    compilationField.appendChild(this.compilationIndicator);
    compilationField.appendChild(document.createTextNode('Compilation'));
    this.statusView.appendChild(compilationField);

    var testingField = document.createElement('div');
    testingField.className = 'info_part bottom';
    this.testingIndicator = document.createElement('div');
    updateIndicator(this.testingIndicator, 'failed');
    testingField.appendChild(this.testingIndicator);
    testingField.appendChild(document.createTextNode('Testing'));
    this.statusView.appendChild(testingField);
};

// ----- Setters -----
CodeScorer.prototype.setPlayer = function (player) {
    this.player = player || {};
    this.sendHandshake();

    this.nicknameField.innerHTML = this.player.nickname || '';
};

CodeScorer.prototype.setLanguage = function (language) {
    this.language = language;

    var mode, defaultCode, languageName;
    switch (language) {
        case 'python':
            mode = 'python';
            languageName = 'Python';
            defaultCode = PYTHON_DEFAULT;
            break;
        case 'c':
            mode = 'text/x-csrc';
            languageName = 'C';
            defaultCode = C_DEFAULT;
            break;
        case 'java':
        default:
            mode = 'text/x-java';
            languageName = 'Java';
            defaultCode = JAVA_DEFAULT;
            break;
    }

    this.editor.setOption('mode', mode);
    this.editor.setValue(defaultCode);

    this.languageField.innerHTML = languageName;
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

    this.editorStyleField.innerHTML = editorName;
};

CodeScorer.prototype.reset = function () {
    this.setPlayer();
    this.setLanguage();
    this.setEditorStyle();
};

CodeScorer.prototype.focus = function () {
    this.editor.focus();
};

CodeScorer.prototype.refresh = function () {
    this.editor.refresh();
};

// ----- State handling -----
CodeScorer.prototype.setupTimer = function () {
    this.timer = {
        start:0,
        end:0,
        running:false
    };

    this.timerTick();
};

CodeScorer.prototype.startTimer = function () {
    this.timer.start = new Date();
    this.timer.running = true;

    var self = this;
    this.timer.interval = setInterval(function () {
        self.timerTick();
    }, TIMER_INTERVAL);

    this.timerTick();
};

CodeScorer.prototype.stopTimer = function () {
    this.timer.end = new Date();
    this.timer.running = false;
    clearInterval(this.timer.interval);

    if (this.timer.start == 0) {
        this.timer.start = this.timer.end;
    }

    this.timerTick();
};

CodeScorer.prototype.timerTick = function () {
    var end = this.timer.running ? new Date() : this.timer.end;
    var elapsed = Math.round((60000 - (end - this.timer.start))/10)/100;

    var time = elapsed;

    if (Math.round(elapsed) == elapsed) {
        time += '.00';
    } else if (Math.round(elapsed*10)/10 == elapsed) {
        time += '0';
    }

    this.timerField.innerHTML = time + 's';
};

CodeScorer.prototype.updateCharCount = function () {
    var charCount = this.editor.getValue().replace(/\s/g, '').length;
    this.charCountField.innerHTML = charCount;
};

CodeScorer.prototype.submit = function () {
    this.stopTimer();
    this.editor.setOption('readOnly', 'nocursor');

    updateIndicator(this.submissionIndicator, 'pending');
    updateIndicator(this.compilationIndicator, 'failed');
    updateIndicator(this.testingIndicator, 'failed');

    this.sendCodeBody();
};

// ----- Connection stuff -----
CodeScorer.prototype.setupConnection = function () {
    this.socket = io.connect('/');

    this.socket.on('connect', function () {
        console.log('Connected to server');
    });

    var self = this;
    this.socket.on('status', function (payload) {
        var indicator;
        switch (payload.mode) {
            case 'submission':
                indicator = self.submissionIndicator;
                break;
            case 'compilation':
                indicator = self.compilationIndicator;
                break;
            case 'testing':
                indicator = self.testingIndicator;
                break;
        }

        var status = 'failed';

        if (payload.success) {
            status = 'success';
        } else if (payload.pending) {
            status = 'pending';
        }

        updateIndicator(indicator, status);
    });

    this.socket.on('result', function (result) {
        console.log('Result: ' + result.message);

        if (result.accepted) {
            console.log('Accepted');
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
        problemID:'problem1',
        language:this.language,
        codeBody:this.editor.getValue()
    });
};

function updateIndicator(indicator, mode) {
    var className = 'status_light ';

    switch (mode) {
        case 'success':
            className += 'green';
            break;
        case 'pending':
            className += 'yellow';
            break;
        case 'failed':
            className += 'red';
            break;
    }

    indicator.className = className;
}

function createClear() {
    var el = document.createElement('div');
    el.style.clear = 'both';

    return el;
}

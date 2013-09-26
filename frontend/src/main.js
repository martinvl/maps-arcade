var io = require('socket.io-client');

var languageSelect = document.getElementById('language_select');
var codeBodyArea = document.getElementById('code_body_area');
var sendButton = document.getElementById('send_button');
var statusField = document.getElementById('status_field');

codeBodyArea.style.fontFamily = "Courier new";
sendButton.style.visibility = "hidden";

var cBody = "long sumEven(long n)\n{\n}";
var javaBody = "public long sumEven(long n) {\n}";
var pythonBody = "def sum_even(n):\n ";

updateBody();

languageSelect.onchange = updateBody;
sendButton.onclick = sendBody;

function updateBody() {
    switch (languageSelect.value) {
        case "c":
            codeBodyArea.value = cBody;
            break;
        case "java":
            codeBodyArea.value = javaBody;
            break;
        case "python":
            codeBodyArea.value = pythonBody;
            break;
    }
}

var socket = io.connect('/');

socket.on('connect', function () {
    sendButton.style.visibility = "visible";
});

socket.on('status', function (message) {
    statusField.innerHTML += message + '<br/>';
});

socket.on('result', function (result) {
    statusField.innerHTML += result.message;

    if (result.accepted) {
        statusField.innerHTML += ' (' + result.runningTime + 's)';
    }
});

function sendBody() {
    statusField.innerHTML = '';
    socket.emit('evaluate', {
        language:languageSelect.value,
        codeBody:codeBodyArea.value
    });
}

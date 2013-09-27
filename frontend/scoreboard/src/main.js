var io = require('socket.io-client');
var _ = require('underscore')._;
var objsync = require('objsync');

var socket = io.connect('http://' + window.location.host + '/results');

socket.on('error', function () {
    socket.socket.reconnect();
});

var sync = new objsync(socket, {delimiter:'/'});

sync.on('update', function () {
    showResults(sync.getObject());
});

function showResults(results) {
    results = _.sortBy(results, function (result) {
        return result.runningTime;
    });
    var displayText = '';

    for (var idx in results) {
        var result = results[idx];

        var runningTime = result.runningTime;
        var time = '';

        if (runningTime < 1/1000) {
            time = Math.round(runningTime*1000000) + '&mu;s';
        } else if (runningTime < 1) {
            time = Math.round(runningTime*1000) + 'ms';
        } else {
            time = Math.round(runningTime*100)/100 + 's';
        }

        displayText += result.name + ' ' + result.language + ' (' + time + ')<br/>';
    }

    document.body.innerHTML = displayText;
}

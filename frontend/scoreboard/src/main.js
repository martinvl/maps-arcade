var io = require('socket.io-client');
var objsync = require('objsync');
var ScoreboardView = require('./ScoreboardView');

var socket = io.connect('http://' + window.location.host + '/results');

var scoreboardView = new ScoreboardView();
document.body.appendChild(scoreboardView.el);

socket.on('error', function () {
    socket.socket.reconnect();
});

var sync = new objsync(socket, {delimiter:'/'});

sync.on('update', function () {
    scoreboardView.setScores(sync.getObject());
});

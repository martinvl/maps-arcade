var io = require('socket.io-client');
var objsync = require('objsync');
var ScoreboardView = require('./ScoreboardView');
var EvalstatusView = require('./EvalstatusView');

// -- Initialize graphical view
var evalstatusView = new EvalstatusView();
// -- todo is to make them separate
var scoreboardPubView = new ScoreboardView('Internet scoreboard');
var scoreboardPrivView = new ScoreboardView('Scoreboard');

scoreboardPubView.el.className = 'scoreboardpub';
scoreboardPrivView.el.className = 'scoreboardpriv';

document.body.appendChild(scoreboardPubView.el);
document.body.appendChild(scoreboardPrivView.el);
document.body.appendChild(evalstatusView.el);

// -- Set up synchronization
function syncobject(url, callback) {
    var sock = io.connect(url);
    sock.on('error', function(err) {
        console.trace(err);
        sock.socket.reconnect();
    });
    var sync = new objsync(sock, {delimiter:'/'});
    sync.on('update', function() {
        callback(sync.getObject());
    });
    return sync;
}
var pubsync = syncobject('http://' + window.location.host + '/pubresults', function(obj) {
    scoreboardPubView.setScores(obj);
});
var privsync = syncobject('http://' + window.location.host + '/privresults', function(obj) {
    scoreboardPrivView.setScores(obj);
});
var evsync = syncobject('http://' + window.location.host + '/evalstatus', function(obj){
    evalstatusView.setStatus(obj);
});

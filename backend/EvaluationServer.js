var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var Q = require('q');
var WebSocketServer = require('ws').Server;

var EvaluationClient = require('./EvaluationClient');

function EvaluationServer(problem, opts) {
    this.problem = problem;
    this.opts = opts || {};

    this.setup();
}

module.exports = EvaluationServer;
inherits(EvaluationServer, EventEmitter);

// --- external API ---
EvaluationServer.prototype.evaluate = function (language, src) {
    console.log('evaluating');
    var submissionId = this.submissionCount++;
    var submission = Q.defer();
    submission.numAccepted = 0;
    submission.evalTime = 0;
    submission.data = {
        submissionId: submissionId,
        language: language,
        src: src
    };
    this.submissions[submissionId] = submission;

    var self = this;

    function send() {
        self.sendSubmission(submission.data, self.getClient()).fail(function (err) {
            console.error('failed sending submission to client');
            console.error(err);

            console.error('retrying...');
            send();
        });
    }
    send();

    return submission.promise;
};

// --- interal API ---
EvaluationServer.prototype.setup = function () {
    this.server = new WebSocketServer(this.opts);
    this.clientCount = 0;
    this.clients = {};
    this.idleClients = {};
    this.submissionCount = 0;
    this.submissions = {};

    var self = this;
    this.server.on('connection', function (socket) {
        console.log('received connection');
        self.handleConnection(socket);
    });
};

EvaluationServer.prototype.handleConnection = function (socket) {
    var clientId = this.clientCount++;
    var client = new EvaluationClient(clientId, socket);
    this.clients[clientId] = client;

    var self = this;
    socket.on('message', function (data) {
        var payload = JSON.parse(data);

        self.handleReceivedEvent(payload, client);
    });

    socket.on('error', function (err) {
        client.deferred.reject(err);
    });

    socket.on('close', function () {
        client.deferred.reject('connection closed');
        delete self.clients[clientId];
        delete self.idleClients[clientId];
    });
};

EvaluationServer.prototype.handleReceivedEvent = function (payload, client) {
    console.dir(payload);
    switch (payload.event) {
        case 'ready':
            client.ready = true;

            if (client.idle) {
                this.idleClients[client.id] = client;
            }

            // TODO handle sendProblem errors
            this.sendProblem(this.problem, client);
            break;
        case 'freeslots':
            client.idle = payload.data.cur > 0;

            if (client.ready) {
                if (client.idle) {
                    this.idleClients[client.id] = client;
                } else {
                    delete this.idleClients[client.id];
                }
            }
            break;
        case 'compile':
            var submission = this.submissions[payload.data.submissionId];

            if (payload.data.success !== 0) {
                submission.reject('compile', payload);
            } else {
                submission.notify('compile', payload);
            }
            break;
        case 'eval':
            var submission = this.submissions[payload.data.submissionId];
            submission.evalTime += payload.data.walltime;

            if (payload.data.success !== 0) {
                submission.reject('eval', payload);
            } else {
                ++submission.numAccepted;
                submission.notify('eval', submission.numAccepted);
            }
            break;
        case 'endsub':
            var submission = this.submissions[payload.data.submissionId];

            if (payload.data.errstr) {
                submission.reject('error', payload.data.errstr);
            } else {
                submission.resolve(submission.evalTime, payload);
            }

            break;
    }
};

EvaluationServer.prototype.getClient = function () {
    // select any idle client if there are any
    for (var idx in this.idleClients) {
        return this.idleClients[idx];
    }

    // select any non-idle client
    // obviously not optimal
    for (var idx in this.clients) {
        return this.clients[idx];
    }
};

EvaluationServer.prototype.sendSubmission = function (submission, client) {
    var payload = JSON.stringify({
        event: 'submission',
        data: submission
    });
    var deferred = Q.defer();
    client.deferred = deferred;

    console.log('sending submission');
    client.socket.send(payload, {}, function () {
        deferred.resolve();
    });

    return deferred.promise;
};

EvaluationServer.prototype.sendProblem = function (problem, client) {
    var payload = JSON.stringify({
        event: 'problem',
        data: problem
    });
    var deferred = Q.defer();
    client.deferred = deferred;

    console.log('sending problem');
    client.socket.send(payload, {}, function () {
        deferred.resolve();
    });

    return deferred.promise;
};

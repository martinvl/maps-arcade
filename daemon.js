var express = require('express');
var http = require('http');
var path = require('path');
var io = require('socket.io');
var Datastore = require('nedb');
var ObjDist = require('objdist');
var Evaluator = require('./Evaluator');

// --- Configuration ---
var PORT = 80;

// --- Setup express ---
var app = express();

var frontendPath = path.join(__dirname, 'frontend');
app.use(express.static(frontendPath));

var server = http.createServer(app);
server.listen(PORT);

// --- Setup result store ---
var resultStore = new Datastore({filename:'results', autoload:true});

// --- Setup socket.io ---
var transport = io.listen(server);

// --- Setup result distribution ---
var dist = new ObjDist(transport, {prefix:'results'});
publishResults();

// --- Setup evaluation ---
var problem1Evaluator = new Evaluator('problem1');

transport.sockets.on('connection', function (socket) {
    var userData;

    socket.on('handshake', function (data) {
        userData = data;
    });

    socket.on('evaluate', function (data) {
        if (!userData) {
            socket.emit('status', 'Needs handshake');
            return;
        }

        var handleStatus = function (message) {
            socket.emit('status', message);
        };

        var handleResult = function (accepted, message, runningTime) {
            var result = {
                problemID:data.problemID,
                accepted:accepted,
                message:message
            };

            if (accepted) {
                result.runningTime = runningTime;

                addResult({
                    problemID:data.problemID,
                    accepted:accepted,
                    runningTime:runningTime,
                    name:userData.name
                });
            }

            socket.emit('result', result)
        };

        var evaluator;

        switch (data.problemID) {
            case "problem1":
                evaluator = problem1Evaluator;
                break;
        }

        switch (data.language) {
            case "c":
                evaluator.evaluateC(data.codeBody, handleStatus, handleResult);
                break;
            case "java":
                evaluator.evaluateJava(data.codeBody, handleStatus, handleResult);
                break;
            case "python":
                evaluator.evaluatePython(data.codeBody, handleStatus, handleResult);
                break;
        }
    });
});

function addResult(result) {
    var query = {
        'problemID':result.problemID,
        'name':result.name,
    };

    resultStore.update(query, result, {upsert:true}, function (err) {
        if (err) {
            console.dir(err);
            return;
        }

        publishResults();
    });
}

function publishResults() {
    resultStore.find({problemID:'problem1'}, function (err, results) {
        if (err) {
            console.dir(err);
            return;
        }

        dist.setObject(results);
    });
}

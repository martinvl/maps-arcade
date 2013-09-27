var express = require('express');
var http = require('http');
var path = require('path');
var io = require('socket.io');
var Evaluator = require('./Evaluator');

// --- Configuration ---
var PORT = 80;

// --- Setup express ---
var app = express();

var frontendPath = path.join(__dirname, 'frontend');
app.use(express.static(frontendPath));

var server = http.createServer(app);
server.listen(PORT);

// --- Setup socket.io ---
var transport = io.listen(server);

var evaluator = new Evaluator('problem1');

transport.sockets.on('connection', function (socket) {
    socket.on('evaluate', function (data) {
        var handleStatus = function (message) {
            socket.emit('status', message);
        };
        var handleResult = function (accepted, message, runningTime) {
            var result = {
                accepted:accepted,
                message:message
            };

            if (accepted) {
                result.runningTime = runningTime;
            }

            socket.emit('result', result)
        };

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

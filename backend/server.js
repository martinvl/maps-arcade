#!/usr/bin/env node

var Datastore = require('nedb');
var express = require('express');
var EvaluationServer = require('./EvaluationServer');
var fs = require('fs');
var http = require('http');
var io = require('socket.io');
var path = require('path');
var Results = require('./Results');

var configPath = process.argv[2] || process.env.npm_package_config || 'config.json';

try {
    var config = JSON.parse(fs.readFileSync(configPath));
} catch (error) {
    console.error('ERROR: Could not read config at ' + configPath);
    process.exit(1);
}

try {
    var problem = JSON.parse(fs.readFileSync(config.problem_config));
} catch (error) {
    console.error('ERROR: Could not read problem at ' + config.problem_config);
}

function taskFromConfig(problem){
    var rf = function(file){
        return String(fs.readFileSync(file));
    }

    //console.log(problem);
    var data = {
        id: problem.id,
        timelimit: (problem.timeout/1000.0),
        memlimit: 0,
        assembly: { /* fill later */ },
        test: { /* fill later */}
    }
    var lang = ['c', 'java', 'python'];
    for(var i in lang) {
        l = lang[i]
            data.assembly[l] = {
                head: rf(problem.precode[l].headPath),
                tail: rf(problem.precode[l].tailPath),
            };
    }
    for(var i in problem.tests) {
        t = problem.tests[i];
        data.test[t.id] = {
            input:  rf(problem.testdataPath+"/"+t.inputPath),
            output: rf(problem.testdataPath+"/"+t.solutionPath),
        };
    }
    return data;
}

// --- Setup express ---
var app = express();

var frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

var server = http.createServer(app);
server.listen(config.port);

// --- Setup socket.io ---
var transport = io.listen(server);

// --- Setup evaluation server ---
var evaluationServer = new EvaluationServer(taskFromConfig(problem), {port: config.evaluation_port}, transport, 'evalstatus');

// --- Setup result distribution ---
var pubresults = new Results(transport, 'pubresults', '../data/pubresults');
var privresults = new Results(transport, 'privresults', '../data/privresults');

transport.sockets.on('connection', function (socket) {
    var userData;
    var requestActive = false;
    // select the correct list based on address
    var priv = socket.conn.remoteAddress == config.privaddr;
    var results = priv ? privresults : pubresults;

    console.log("frontend connection from "+socket.handshake.address+" is"+(priv ? "" : " not")+" private");

    socket.on('email', function (email) {
        addEmail(email);
    });

    socket.on('handshake', function (data) {
        userData = data;
    });

    socket.on('evaluate', function (data) {
        if (!userData) {
            socket.emit('status', {mode:'submission', success:false, message:'Needs handshake'});
            return;
        }
        if(requestActive == true) {
            // Just ignore the client
            // socket.emit('status', {mode:'submission', success:false, message:'Only one request allowed at a time'});
            return;
        }

        socket.emit('status', {mode:'submission', success:true});
        requestActive = true;

        var result = {
            problemID: data.problemID,
            impTime:   data.impTime,
            codeSize:  codeSize(data.codeBody),
            language:  data.language,
            name:      userData.name
        };

        var eval = evaluationServer.evaluate(data.language, data.codeBody);
        if(eval) eval
        .then(function (runningTime) {
            // On success
            result.accepted = true;
            result.runTime = runningTime;

            // send result back to client
            results.sendResult(result, socket);

            // store result
            socket.emit('status', {mode:'testing', success: true});
            results.addResult(result);
            requestActive = false;
        },
        function (state, data) {
            // Fail
            result.accepted = false;
            socket.emit('status', {mode:'testing', success: false});
            socket.emit('result', result)
            requestActive = false;
        },
        function (event, status) {
            // Other events
            if (event === 'compile') {
                // Testing in progress
                socket.emit('status', {mode:'compilation', success: true});
                socket.emit('status', {mode:'testing', pending: true});
            }
        });
        else {
            // We have no test servers available
            socket.emit('status', {mode:'submission', success: false, message: 'No evaluation servers available'});
            requestActive = false;
        }
    });
});

function addEmail(email) {
    var query = {
        email:email
    };

    emailStore.update(query, query, {upsert:true}, function (err) {
        if (err) {
            console.dir(err);
            return;
        }
    });
}

function codeSize(code) {
    return code.replace(/\s/g, '').length;
}

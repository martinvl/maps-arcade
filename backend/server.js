#!/usr/bin/env node

var Datastore = require('nedb');
var express = require('express');
var EvaluationServer = require('./EvaluationServer');
var fs = require('fs');
var http = require('http');
var io = require('socket.io');
var ObjDist = require('objdist');
var path = require('path');

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

// --- Setup persistent stores ---
var resultStore = new Datastore({filename:'../data/results', autoload:true});
var emailStore = new Datastore({filename:'../data/emails', autoload:true});

// --- Setup socket.io ---
var transport = io.listen(server);

// --- Setup evaluation server ---
var evaluationServer = new EvaluationServer(taskFromConfig(problem), {port: config.evaluation_port});

// --- Setup result distribution ---
var dist = new ObjDist(transport, {prefix:'results'});
publishResults();

transport.sockets.on('connection', function (socket) {
    var userData;

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

        socket.emit('status', {mode:'submission', success:true});

        var result = {
            problemID:data.problemID,
        impTime:data.impTime,
        codeSize:codeSize(data.codeBody),
        language:data.language,
        name:userData.name
        };

        evaluationServer.evaluate(data.language, data.codeBody)
        .then(function (runningTime) {
            result.accepted = true;
            result.runTime = runningTime;

            // send result back to client
            dist.once('update', function () {
                var results = dist.getObject();

                for (var idx in results) {
                    var rankedResult = results[idx];

                    if (rankedResult.name == result.name && rankedResult.problemID == result.problemID) {
                        socket.emit('result', rankedResult);
                        break;
                    }
                }
            });

            // store result
            socket.emit('status', {mode:'testing', success: true});
            addResult(result);
        },
        function (state, data) {
            result.accepted = false;
            socket.emit('status', {mode:'testing', success: false});
            socket.emit('result', result)
        },
        function (event, status) {
            if (event === 'compile') {
                socket.emit('status', {mode:'compilation', success: true});
                socket.emit('status', {mode:'testing', pending: true});
            }
        });
    });
});

function addResult(result) {
    var query = {
        'problemID':result.problemID,
        'name':result.name
    };

    resultStore.update(query, result, {upsert:true}, function (err) {
        if (err) {
            console.dir(err);
            return;
        }

        publishResults();
    });
}

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

function getRankedResults(results) {
    results = results.slice(0); // copy

    results.sort(function (lhs, rhs) {
        var lhsBadness =  lhs.impTime * lhs.runTime * lhs.codeSize;
        var rhsBadness =  rhs.impTime * rhs.runTime * rhs.codeSize;

        return lhsBadness/rhsBadness - 1;
    });

    for (var rank in results) {
        results[rank].rank = parseInt(rank) + 1;
    }


    return results;
}

function publishResults() {
    resultStore.find({}, function (err, results) {
        if (err) {
            console.dir(err);
            return;
        }

        results = getRankedResults(results);

        for (var idx in results) {
            var result = results[idx];

            result.impTime = formatTime(result.impTime);
            result.runTime = formatTime(result.runTime);
        }

        dist.setObject(results);
    });
}

function formatTime(time) {
    var formattedTime = '';

    if (time < 1/1000) {
        formattedTime = Math.round(time*1000000) + '&mu;s';
    } else if (time < 1/10) {
        formattedTime = Math.round(time*1000) + 'ms';
    } else {
        time = Math.round(time*100)/100;

        if (time == Math.round(time)) {
            formattedTime = time + '.00s';
        } else if (time == Math.round(time*10)/10) {
            formattedTime = time + '0s';
        } else {
            formattedTime = time + 's';
        }
    }

    return formattedTime;
}

function codeSize(code) {
    return code.replace(/\s/g, '').length;
}

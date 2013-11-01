#!/usr/bin/env node

var Datastore = require('nedb');
var express = require('express');
var SandboxEvaluator = require('./SandboxEvaluator');
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

// --- Setup express ---
var app = express();

var frontendPath = path.join(__dirname, 'frontend');
app.use(express.static(frontendPath));

var server = http.createServer(app);
server.listen(config.port);

// --- Setup persistent stores ---
var resultStore = new Datastore({filename:'results', autoload:true});
var emailStore = new Datastore({filename:'emails', autoload:true});

// --- Setup socket.io ---
var transport = io.listen(server);

// --- Setup result distribution ---
var dist = new ObjDist(transport, {prefix:'results'});
publishResults();

transport.sockets.on('connection', function (socket) {
    var userData;
    var evaluator;

    socket.on('email', function (email) {
        addEmail(email);
    });

    socket.on('handshake', function (data) {
        userData = data;
        evaluator = setupEvaluator(userData.name, socket);
    });

    socket.on('evaluate', function (data) {
        if (!userData || !evaluator) {
            socket.emit('status', {mode:'submission', success:false, message:'Needs handshake'});
            return;
        }

        socket.emit('status', {mode:'submission', success:true});

        evaluator.setLanguage(data.language);
        evaluator.setCodebody(data.codeBody);

        evaluator.once('result', function (result) {
            result.problemID = data.problemID;

            if (result.accepted) {
                result.runTime = formatTime(result.runningTime);
                result.impTime = formatTime(data.impTime);
                result.codeSize = codeSize(data.codeBody);

                var storedResult = {
                    problemID:result.problemID,
                    runTime:result.runningTime,
                    impTime:data.impTime,
                    codeSize:result.codeSize,
                    language:data.language,
                    name:userData.name
                };

                dist.once('update', function () {
                    var results = dist.getObject();

                    for (var idx in results) {
                        var rankedResult = results[idx];

                        if (rankedResult.name == storedResult.name && rankedResult.problemID == storedResult.problemID) {
                            result.rank = rankedResult.rank;
                            break;
                        }
                    }

                    socket.emit('result', result)
                });

                addResult(storedResult);
            } else {
                socket.emit('result', result)
            }
        });

        evaluator.evaluate(function (error) {});
    });
});

function setupEvaluator(name, socket) {
    var evaluator = new SandboxEvaluator(path.resolve(name), config.uid);
    evaluator.setProblem(problem);

    evaluator.on('status', function (status) {
        if (status.mode != 'assembly') {
            socket.emit('status', status);
        }
    });

    evaluator.on('error', function (error) {
        console.error(error);
    });

    return evaluator;
}

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

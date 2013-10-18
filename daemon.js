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

// --- Setup persistent stores ---
var resultStore = new Datastore({filename:'results', autoload:true});
var emailStore = new Datastore({filename:'emails', autoload:true});

// --- Setup socket.io ---
var transport = io.listen(server);

// --- Setup result distribution ---
var dist = new ObjDist(transport, {prefix:'results'});
publishResults();

// --- Setup evaluation ---
var problem1Evaluator = new Evaluator('problem1');

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

        var handleStatus = function (status) {
            socket.emit('status', status);
        };

        var handleResult = function (accepted, message, runningTime) {
            var result = {
                problemID:data.problemID,
                accepted:accepted,
                message:message
            };

            if (accepted) {
                result.runTime = formatTime(runningTime);
                result.impTime = formatTime(data.impTime);
                result.codeSize = codeSize(data.codeBody);

                var storedResult = {
                    problemID:data.problemID,
                    runTime:runningTime,
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

    var ranks = {};
    for (var idx in results) {
        ranks[results[idx]] = 0;
    }

    // get rank by impTime
    results.sort(function (lhs, rhs) {
        return lhs.impTime - rhs.impTime;
    });

    for (var rank in results) {
        ranks[results[rank].name] += rank;
    }

    // get rank by runTime
    results.sort(function (lhs, rhs) {
        return lhs.runTime - rhs.runTime;
    });

    for (var rank in results) {
        ranks[results[rank].name] += rank;
    }

    // get rank by codeSize
    results.sort(function (lhs, rhs) {
        return lhs.codeSize - rhs.codeSize;
    });

    for (var rank in results) {
        ranks[results[rank].name] += rank;
    }

    // rank overall
    results.sort(function (lhs, rhs) {
        var deltaRank = ranks[lhs.name] - ranks[rhs.name];

        if (deltaRank == 0) {
            return (lhs.impTime*lhs.runTime)/(rhs.impTime*rhs.runTime) - 1;
        }

        return deltaRank;
    });

    for (var rank in results) {
        results[rank].rank = parseInt(rank) + 1;
    }

    return results;
}

function publishResults() {
    resultStore.find({problemID:'problem1'}, function (err, results) {
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

#!/usr/bin/env node

var Datastore = require('nedb');
var express = require('express');
var EvaluationServer = require('./EvaluationServer');
var fs = require('fs');
var http = require('http');
var io = require('socket.io');
var path = require('path');
var Results = require('./Results');
var _ = require('underscore');

var configPath = process.argv[2] || process.env.npm_package_config || 'config.json';

try {
    var config = JSON.parse(fs.readFileSync(configPath));
} catch (error) {
    console.error('ERROR: Could not read config at ' + configPath);
    process.exit(1);
}

try {
    var problem = JSON.parse(fs.readFileSync(config.problem_config));
    var publicProblem = _.pick(problem, [
        'id',
        'codingTimeout',
        'pythonDefault',
        'cDefault',
        'javaDefault',
        'description',
        'definition',
        'examples'
    ]);
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

app.get('/problem', function (req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(publicProblem));
});

var server = http.createServer(app);
server.listen(config.port);

// --- Setup persistent stores ---
var emailStore = new Datastore({filename:'../data/emails', autoload:true});

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
        // Frontend 'status' event:
        // Needs status and message:
        // Status: idle, success, pending, failed
        if (!userData) {
            socket.emit('status', {status:'failed', message:'Needs handshake'});
            return;
        }
        if(requestActive == true) {
            // Make sure client does not update the field by itself
            return;
        }

        socket.emit('status', {status:'pending', message:'Compiling'});
        requestActive = true;

        var result = {
            problemID: data.problemID,
            impTime:   data.impTime,
            codeSize:  codeSize(data.codeBody),
            language:  data.language,
            name:      userData.name,
            code:      data.codeBody,
        };

        var eval = evaluationServer.evaluate(data.language, data.codeBody);

        // To determine where we failed
        var progress = 'compiling';

        if(eval) eval
        .then(function (runningTime) {
            // On success
            result.accepted = true;
            result.runTime = runningTime;

            // send result back to client
            results.sendResult(result, socket);

            // store result
            socket.emit('status', {status:'success', message: 'Success!'});
            results.addResult(result);
            requestActive = false;
        },
        function (payload) {
            // reject
	    var event = payload.event;
	    var status = payload.status;
	    var message = '';

            result.accepted = false;
	    if(progress == 'compiling'){
		    message = 'Did not compile:\n' + status.stderr;
	    } else {
		if(status == 1) message = 'Wrong answer';
		else if(status == 2) message = 'Program crashed';
		else if(status == 3) message = 'Timeout expired';
		else {
			message = ""+status;
		}
	    }

            socket.emit('status', {
                status:'failed',
                message: message
            });
            socket.emit('result', result)
            requestActive = false;
        },
        function (payload) {
            // notify
	    var event = payload.event;
	    var status = payload.status;
	    console.log(["notify", event,status]);
            if (event === 'compile') {
                progress = 'testing';
                // Testing in progress
                socket.emit('status', {status:'pending', message: 'Testing'});
            }
        });
        else {
            // We have no test servers available
            socket.emit('status', {status:'failed', message: 'Backend has no eval servers'});
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

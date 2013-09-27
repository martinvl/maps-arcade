var exec = require('child_process').exec;

var TIMEOUT = 5 * 1000;

function Evaluator() {
}

module.exports = Evaluator;

Evaluator.prototype.evaluateJava = function (codeBody, statusCallback, callback) {
    this.evaluate(codeBody, this.buildJava, this.testJava, statusCallback, callback);
};

Evaluator.prototype.evaluatePython = function (codeBody, statusCallback, callback) {
    this.evaluate(codeBody, this.buildPython, this.testPython, statusCallback, callback);
};

Evaluator.prototype.evaluateC = function (codeBody, statusCallback, callback) {
    this.evaluate(codeBody, this.buildC, this.testC, statusCallback, callback);
};

Evaluator.prototype.evaluate = function (codeBody, build, test, statusCallback, callback) {
    statusCallback('Compiling...');
    var self = this;

    build.apply(this, [codeBody, function (error) {
        if (error) {
            callback(false, error);
        } else {
            statusCallback('Testing...');
            test.apply(self, [statusCallback, callback]);
        }
    }]);
};


Evaluator.prototype.buildJava = function (codeBody, callback) {
    var compile = function (error) {
        if (error) {
            callback('Compilation failed');
            return;
        }

        exec('javac stage/Solver.java -d bin &> compilation.log', function (error) {
            if (error) {
                callback('Compilation failed');
                return;
            }

            callback();
        });
    };

    var addTail = function (error) {
        if (error) {
            callback('Assembly failed');
            return;
        }

        exec('cat java/tail >> stage/Solver.java', compile);
    };

    var addBody = function (error) {
        if (error) {
            callback('Assembly failed');
            return;
        }

        exec('echo "' + codeBody + '" >> stage/Solver.java', addTail);
    };

    var addHead = function (error) {
        exec('cat java/head >> stage/Solver.java', addBody);
    };

    exec('rm stage/Solver.java', addHead);
};

Evaluator.prototype.buildPython = function (codeBody, callback) {
    var addTail = function (error) {
        if (error) {
            callback('Assembly failed');
            return;
        }

        exec('cat python/tail >> bin/solver.py', function (error) {
            if (error) {
                callback('Assembly failed');
                return;
            }

            callback();
        });
    };

    var addBody = function (error) {
        if (error) {
            callback('Assembly failed');
            return;
        }

        exec('echo "' + codeBody + '" >> bin/solver.py', addTail);
    };

    var addHead = function (error) {
        exec('cat python/head >> bin/solver.py', addBody);
    };

    exec('rm bin/solver.py', addHead);
};

Evaluator.prototype.buildC = function (codeBody, callback) {
    var compile = function (error) {
        if (error) {
            callback('Compilation failed');
            return;
        }

        exec('gcc -std=gnu99 -O2 stage/solver.c -o bin/solver -lrt &> compilation.log', function (error) {
            if (error) {
                callback('Compilation failed');
                return;
            }

            callback();
        });
    };

    var addTail = function (error) {
        if (error) {
            callback('Assembly failed');
            return;
        }

        exec('cat c/tail >> stage/solver.c', compile);
    };

    var addBody = function (error) {
        if (error) {
            callback('Assembly failed');
            return;
        }

        exec('echo "' + codeBody + '" >> stage/solver.c', addTail);
    };

    var addHead = function (error) {
        exec('cat c/head >> stage/solver.c', addBody);
    };

    exec('rm stage/solver.c', addHead);
};

Evaluator.prototype.testJava = function (statusCallback, callback) {
    this.test('java -cp "bin" Solver', statusCallback, callback);
};

Evaluator.prototype.testPython = function (statusCallback, callback) {
    this.test('python bin/solver.py', statusCallback, callback);
};

Evaluator.prototype.testC = function (statusCallback, callback) {
    this.test('bin/solver', statusCallback, callback);
};

Evaluator.prototype.test = function (command, statusCallback, callback) {
    var numTests = 8;
    var numCorrect = 0;
    var totalRunningTime = 0;
    var failed = false;

    for (var testID = 1; testID <= numTests && !failed; ++testID) {
        this.executeTest(testID, command, function (accepted, message, runningTime) {
            if (failed) {
                return;
            }

            if (accepted) {
                ++numCorrect;
                totalRunningTime += runningTime;

                statusCallback('Passed test ' + numCorrect + '/' + numTests);

                if (numCorrect == numTests) {
                    callback(true, 'Accepted', totalRunningTime);
                }
            } else {
                failed = true;
                callback(false, message);
            }
        });
    }
};

Evaluator.prototype.executeTest = function (testID, command, callback) {
    var inputPath = 'testdata/test' + testID + '.in';
    var answerPath = 'testdata/test' + testID + '.ans';

    exec(command + ' < ' + inputPath, {timeout:TIMEOUT}, function (error, stdout, stderr) {
        if (error) {
            if (error.signal == 'SIGTERM') {
                callback(false, 'Timelimit exceeded');
            } else {
                callback(false, 'Runtime error');
            }
        } else {
            var result = stdout.toString();
            var runningTime = Number(stderr.toString());

            exec('(echo ' + stdout.toString() + ') | diff ' + answerPath + ' -', function (error, stdout, stderr) {
                if (error) {
                    if (error.signal == 'SIGTERM') {
                        callback(false, 'Timelimit exceeded');
                    } else {
                        callback(false, 'Wrong answer');
                    }
                    return;
                }

                callback(true, 'Accepted', runningTime);
            });
        }

    });
};

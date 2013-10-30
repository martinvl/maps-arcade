var child_process = require('child_process');
var EventEmitter = require('events').EventEmitter;
var fs = require('fs');
var inherits = require('inherits');
var path = require('path');

function SandboxEvaluator(root, uid) {
    this.root = path.resolve(root);
    this.uid = uid;

    this.setup();
}

inherits(SandboxEvaluator, EventEmitter);
module.exports = SandboxEvaluator;

SandboxEvaluator.prototype.setup = function () {
    var self = this;
    child_process.execFile(path.join(__dirname, 'setup_account.sh'), [this.root], {}, function (error, stdout, stderr) {
        if (error) {
            self.fail('setup', error);
        }
    });
};

SandboxEvaluator.prototype.setProblem = function (problem) {
    this.problem = problem;

    var self = this;
    child_process.execFile(path.join(__dirname, 'setup_sandbox.sh'), [this.getProblemPath()], {}, function (error, stdout, stderr) {
        if (error) {
            self.fail('problem setup', error);
        }
    });
};

SandboxEvaluator.prototype.setCodebody = function (codebody) {
    this.codebody = codebody;
};

SandboxEvaluator.prototype.setLanguage = function (language) {
    this.language = language;
};

SandboxEvaluator.prototype.evaluate = function (callback) {
    if (this.evaluating) {
        callback('Evaluator busy');
        return;
    }

    this.evaluating = true;

    var self = this;
    this.assemble(function (error) {
        if (error) {
            self.evaluating = false;
            callback(error);
            return;
        }

        self.compile(function (error) {
            if (error) {
                self.evaluating = false;
                callback(error);
                return;
            }

            self.test(function (accepted, message, runningTime) {
                self.emit('result', {accepted:accepted, message:message, runningTime:runningTime});

                if (accepted) {
                    callback();
                } else {
                    callback(message);
                }
            });
            self.evaluating = false;
        });
    });
};

// ---- Assembly ----
SandboxEvaluator.prototype.assemble = function (callback) {
    this.emit('status', {mode:'assembly', pending:true});

    var head, tail;

    var self = this;
    var precodeBarrier = function () {
        if (!head || !tail) {
            return;
        }

        var code = head + self.codebody + tail;

        fs.writeFile(self.getSrcPath(), code, function (error) {
            if (error) {
                self.fail('assembly', error);
                callback('Assembly failed');
                return;
            }

            self.emit('status', {mode:'assembly', success:true});
            callback();
        });
    };

    fs.readFile(this.problem.precode[this.language].headPath, function (error, data) {
        if (error) {
            self.fail('assembly', error);
            callback('Can\'t read precode head');
        }

        head = data;
        precodeBarrier();
    });

    fs.readFile(this.problem.precode[this.language].tailPath, function (error, data) {
        if (error) {
            self.fail('assembly', error);
            callback('Can\'t read precode tail');
        }

        tail = data;
        precodeBarrier();
    });
};

// ---- Compilation ----
SandboxEvaluator.prototype.compile = function (callback) {
    this.emit('status', {mode:'compilation', pending:true});

    var self = this;
    var compilationCallback = function (error) {
        if (error) {
            self.fail('compilation', error);
        } else {
            self.emit('status', {mode:'compilation', success:true});
        }

        callback(error);
    };

    switch (this.language) {
        case 'python':
            compilationCallback();
            break;
        case 'java':
            this.compileJava(compilationCallback);
            break;
        case 'c':
            this.compileC(compilationCallback);
            break;
        default:
            compilationCallback('Unknown language');
    }
};

SandboxEvaluator.prototype.compileJava = function (callback) {
    var srcPath = this.getSrcPath();
    var binPath = this.getBinPath();

    var self = this;
    child_process.exec('javac ' + srcPath + ' -d ' + this.getProblemPath(), function (error, stdout, stderr) {
        var compilationOutput = stdout.toString() + '\n' + stderr.toString();
        self.log(compilationOutput);
        self.emit('compilation-output', compilationOutput);

        if (error) {
            callback('Compilation failed');
            return;
        }

        callback();
    });
};

SandboxEvaluator.prototype.compileC = function (callback) {
    var srcPath = this.getSrcPath();
    var binPath = this.getBinPath();

    var self = this;
    child_process.exec('gcc -std=gnu99 -O2 ' + srcPath + ' -o ' + binPath + ' -lrt', function (error, stdout, stderr) {
        var compilationOutput = stdout.toString() + '\n' + stderr.toString();
        self.log(compilationOutput);
        self.emit('compilation-output', compilationOutput);

        if (error) {
            callback('Compilation failed');
            return;
        }

        callback();
    });
};

// ---- Testing ----
SandboxEvaluator.prototype.test = function (callback) {
    var numTests = this.problem.tests.length;
    var numPassed = 0;
    var totalRunningTime = 0;
    var failed = false;
    var testdataPath = this.problem.testdataPath;

    this.emit('status', {mode:'testing', pending:true, numPassed:numPassed, numTests:numTests});

    for (var idx in this.problem.tests) {
        var test = this.problem.tests[idx];
        this.log('Testing ' + this.problem.id + '.' + test.id);

        var self = this;
        this.runTest(function (accepted, message, runningTime) {
            if (failed) {
                return;
            }

            if (accepted) {
                ++numPassed;
                totalRunningTime += runningTime;

                self.emit('status', {
                    mode:'testing',
                    pending:true,
                    numPassed:numPassed,
                    numTests:numTests
                });

                if (numPassed == numTests) {
                    callback(true, 'Accepted', totalRunningTime);

                    self.emit('status', {
                        mode:'testing',
                        success:true
                    });
                }
            } else {
                failed = true;
                self.fail('testing', message);
                callback(false, message);
            }
        }, test);
    }
};

SandboxEvaluator.prototype.runTest = function (callback, test) {
    var testdataPath = this.problem.testdataPath;
    var inputPath = path.join(testdataPath, test.inputPath);
    var solutionPath = path.join(testdataPath, test.solutionPath);

    var output, solution, runningTime;

    var self = this;
    var testBarrier = function () {
        if (!output || !solution) {
            return;
        }

        if (output == solution) {
            callback(true, 'Accepted', runningTime);
        } else {
            callback(false, 'Wrong answer');
        }
    };

    child_process.exec(this.getRunCommand() + ' < ' + inputPath, {timeout:this.problem.timeout}, function (error, stdout, stderr) {
        output = stdout.toString();
        var errput = stderr.toString();

        self.log(output);
        self.log(errput);

        if (error) {
            var errorMessage = error.signal == 'SIGTERM' ? 'Timelimit exceeded' : 'Runtime error';

            callback(false, errorMessage);
            self.log(errorMessage);
        } else {
            runningTime = Number(errput);
            testBarrier();
        }
    });

    fs.readFile(solutionPath, function (error, data) {
        if (error) {
            callback(false, 'Cannot read solution');
        } else {
            solution = data;
            testBarrier();
        }
    });
};

// ---- Misc ----
SandboxEvaluator.prototype.getSrcPath = function () {
    var srcPath = this.problem.precode[this.language].srcPath;

    return path.join(this.getProblemPath(), srcPath);
};

SandboxEvaluator.prototype.getBinPath = function () {
    var binPath = this.problem.precode[this.language].binPath;

    return path.join(this.getProblemPath(), binPath);
};

SandboxEvaluator.prototype.getLogPath = function () {
    return path.join(this.root, 'log');
};

SandboxEvaluator.prototype.getProblemPath = function () {
    return path.join(this.root, this.problem.id);
};

SandboxEvaluator.prototype.getRunCommand = function () {
    var command = path.resolve('sandbox_test.js');

    command += ' ' + this.getProblemPath();
    command += ' ' + this.uid;

    switch (this.language) {
        case 'python':
            command += ' python ';
            break;
        case 'java':
            command += ' java ';
            break;
        case 'c':
            command += ' ./';
            break;
    }

    command += this.problem.precode[this.language].binPath;

    return command;
};

SandboxEvaluator.prototype.log = function (data) {
    fs.appendFile(this.getLogPath(), data + '\n');
};

SandboxEvaluator.prototype.fail = function (mode, error) {
    this.log(mode + ' failed with error:\n' + error);

    this.emit('status', {mode:mode, success:false, message:error});
    this.emit('result', {accepted:false, message:error});
    this.emit('error', error);
};

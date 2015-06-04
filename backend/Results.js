var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var ObjDist = require('objdist');
var Datastore = require('nedb');
var _ = require('underscore');

function Results(transport, prefix, filename) {
    this.dist = new ObjDist(transport, {prefix:prefix});
    this.store = new Datastore({filename: filename, autoload: true});
    this.publishResults();
}

module.exports = Results;
inherits(Results, EventEmitter);

Results.prototype.sendResult = function(result, socket) {
    var self = this;
    this.once('publish', function(){
        var results = self.dist.getObject();

        for (var idx in results) {
            var rankedResult = results[idx];

            if (rankedResult.name == result.name && rankedResult.problemID == result.problemID) {
                var sendResult = _.clone(result);

                sendResult.rank = rankedResult.rank;
                sendResult.impTime = self.formatTime(result.impTime);
                sendResult.runTime = self.formatTime(result.runTime);
                sendResult = _.pick(sendResult, ['problemID', 'rank', 'language', 'name', 'impTime', 'runTime', 'codeSize', 'accepted']);

                socket.emit('result', sendResult);
                console.dir(result);
                return;
            }
        }
        console.err("Results.prototype.sendResult: We are asked to send the result for "+result.name+" at problem "+result.problemID+" but no such result exists!");
    });
};

// We are forced to call self.publishResults() at some point.
Results.prototype.addResult = function(result) {
    // TODO: Q
    var query = {
        'problemID': result.problemID,
        'name':      result.name
    };
    var self = this;

    // We need to get the results before we formatted them and added them to the public object
    // Only interested in this users results
    this.store.find(query, function(err, results) {
        if (err) {
            console.dir(err);
            return;
        }

        var update = true;
        for (var idx in results) {
            var rankedResult = results[idx];

            // This one is worse (Is my operator pointing the right way?)
            if (result_cmp(rankedResult, result) < 0) {
                console.log("Old result is better, not updating: (old, new):");
                console.log(rankedResult);
                console.log(result);
                update = false;
            } else {
                console.log("New result is better, updating");
            }
            break;
        }

        if (update) {
            self.store.update(query, result, {upsert:true}, function (err) {
                if (err) {
                    console.dir(err);
                    return;
                }

                self.publishResults();
            });
        } else {
            self.publishResults();
        }
    });
};

Results.prototype.formatTime = function(time) {
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
};

Results.prototype.getRankedResults = function(results) {
    // TODO: Why copy?
    var results = results.slice(0); // copy

    results.sort(result_cmp);

    for (var rank in results) {
        results[rank].rank = parseInt(rank) + 1;
    }

    return results;
};

Results.prototype.publishResults = function() {
    var self = this;
    this.store.find({}, function(err, results) {
        if (err) {
            console.dir(err);
            return;
        }

        results = self.getRankedResults(results);

        for (var idx in results) {
            var result = results[idx];

            result.impTime = self.formatTime(result.impTime);
            result.runTime = self.formatTime(result.runTime);
            results[idx] = _.pick(result, ['problemID', 'rank', 'language', 'name', 'impTime', 'runTime', 'codeSize', 'accepted']);
        }

        self.dist.setObject(results);
        self.emit('publish');
    });
};

function result_cmp(lhs, rhs) {
    // var lhsBadness = (1e-7 + lhs.impTime) * (1e-7 + lhs.runTime) * (1 + lhs.codeSize);
    // var rhsBadness = (1e-7 + rhs.impTime) * (1e-7 + rhs.runTime) * (1 + rhs.codeSize);
    // hack: ignore impTime
    var lhsBadness = (1e-7 + lhs.runTime) * (1 + lhs.codeSize);
    var rhsBadness = (1e-7 + rhs.runTime) * (1 + rhs.codeSize);

    return lhsBadness/rhsBadness - 1;
}

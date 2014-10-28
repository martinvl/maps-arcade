var ObjDist = require('objdist');
var Datastore = require('nedb');

function Results(transport, prefix, filename) {
    this.dist = new ObjDist(transport, {prefix:prefix});
    this.store = new Datastore({filename: filename, autoload: true});
    this.publishResults();
}

module.exports = Results;

Results.prototype.sendResult = function(result, socket) {
    var self = this;
    this.dist.once('update', function(){
        var results = self.dist.getObject();

        for (var idx in results) {
            var rankedResult = results[idx];

            if (rankedResult.name == result.name && rankedResult.problemID == result.problemID) {
                socket.emit('result', rankedResult);
                break;
            }
        }
    });
};

Results.prototype.addResult = function(result) {
    var query = {
        'problemID': result.problemID,
        'name':      result.name
    };

    var self = this;
    this.store.update(query, result, {upsert:true}, function (err) {
        if (err) {
            console.dir(err);
            return;
        }

        self.publishResults();
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
    var results = results.slice(0); // copy

    results.sort(function (lhs, rhs) {
        var lhsBadness = lhs.impTime * lhs.runTime * lhs.codeSize;
        var rhsBadness = rhs.impTime * rhs.runTime * rhs.codeSize;

        return lhsBadness/rhsBadness - 1;
    });

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
        }

        self.dist.setObject(results);
    });
};

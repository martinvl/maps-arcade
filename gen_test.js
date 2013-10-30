var numTests = 19;
var tests = [];

for (var i = 1; i <= numTests; ++i) {
    var test = {
        id:'test' + i,
        inputPath:'test' + i + '.in',
        solutionPath:'test' + i + '.ans'
    };

    tests.push(test);
}

console.log(JSON.stringify(tests));

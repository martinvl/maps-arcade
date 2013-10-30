var path = require('path');
var SandboxEvaluator = require('./SandboxEvaluator');

var evaluator = new SandboxEvaluator(path.resolve('martinvl'), 'martinvl');

evaluator.on('error', function (error) {
    console.dir(error);
});

var problem =  {
   "id":"problem2",
   "precode":{
       "python":{
           "headPath":"problem2/python/head",
           "tailPath":"problem2/python/tail"
       },
       "java":{
           "headPath":"problem2/java/head",
           "tailPath":"problem2/java/tail"
       },
       "c":{
           "headPath":"problem2/c/head",
           "tailPath":"problem2/c/tail"
       }
   },
   "testdataPath":"problem2/testdata",
   "timeout":10,
   "tests":[
      {
         "id":"test1",
         "inputPath":"test1.in",
         "solutionPath":"test1.ans"
      }
   ]
};

evaluator.setProblem(problem);

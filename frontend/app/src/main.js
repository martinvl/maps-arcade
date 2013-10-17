var SetupView = require('./SetupView');
var CodeScorer = require('./CodeScorer');

var setupViewEl = document.createElement('div');
document.body.appendChild(setupViewEl);
var setupView = new SetupView(setupViewEl);

setupView.on('submit', function (setup) {
    console.dir(setup);
});

/*
var el = document.createElement('div');
document.body.appendChild(el);
var scorer = new CodeScorer(el);

scorer.setPlayer({
    nickname:'martinvl',
    email:'martinvl@student.matnat.uio.no'
});
scorer.setLanguage('java');
scorer.setEditorStyle('vim');
*/

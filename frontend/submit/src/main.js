var CodeScorer = require('./CodeScorer');

var el = document.createElement('div');
document.body.appendChild(el);
var scorer = new CodeScorer(el);

scorer.setPlayer({
    nickname:'martinvl',
    email:'martinvl@student.matnat.uio.no'
});
scorer.setLanguage('java');
scorer.setEditorStyle('vim');

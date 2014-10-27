var child_process = require('child_process');

if (process.argv.length < 5) {
    console.error('USAGE: sandbox_test <root> <uid> <command> <args ...>');
    process.exit(1);
}

var root = process.argv[2];
var uid = Number(process.argv[3]);
var command = process.argv[4];
var args = process.argv.slice(5);

var child_proc = child_process.spawn(command, args, {cwd:root, uid:uid, stdio:'inherit'});

child_proc.on('exit', function (code, signal) {
    process.exit(code);
});

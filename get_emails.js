var Datastore = require('nedb');
var emailStore = new Datastore({filename:'emails', autoload:true});

emailStore.find({}, function (err, emails) {
    if (err) {
        console.dir(err);
        return;
    }

    for (var i = 0; i < emails.length; ++i) {
        if (i < emails.length-1) {
            console.log(emails[i].email + ',');
        } else {
            console.log(emails[i].email);
        }
    }
});

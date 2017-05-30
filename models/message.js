var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// set up a mongoose model
module.exports = mongoose.model('message', new Schema({

    content:String,
    roomid:String,
    userid:String,
    username:String
}));

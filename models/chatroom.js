var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// set up a mongoose model
module.exports = mongoose.model('chatroom', new Schema({
	roomname: String,
	user: [String]
}));

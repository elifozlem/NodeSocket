var express = require('express');
var bodyParser  = require('body-parser');
var config = require('./config');

var http = require('http');
app = module.exports.app = express();

var server = http.createServer(app);
var io = require('socket.io').listen(server);
var route=require('./route');

app.set('port', (process.env.PORT || 5000));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
server.listen(app.get('port'));
console.log('Node app is running on port', app.get('port'));
route(app,io);

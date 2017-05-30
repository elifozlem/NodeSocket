var express = require('express');
var apiRoutes 	= express.Router();
var jwt    	= require('jsonwebtoken');
var User   = require('./models/user');
var ChatRoom=require('./models/chatroom.js');
var Message=require('./models/message');
var config = require('./config');
var bodyParser  = require('body-parser');
var mongoose    = require('mongoose');
mongoose.Promise = global.Promise;
mongoose.connect(config.database); // connect to database




module.exports = function(app,io) {
    app.set('superSecret', config.secret);
    app.use(bodyParser.urlencoded({extended: false}));
    app.use(bodyParser.json());
    apiRoutes.post('/authenticate', function (req, res) {

        // find the user
        User.findOne({
            name: req.body.name
        }, function (err, user) {

            if (err) throw err;

            if (!user) {
                res.json({success: false, message: 'Giriş başarısız.Kullanıcı bulunamadı.'});
            }   //boyle bir kullanici yoksa hata verir
            else if (user) {

                // sifre eslesmezse
                if (user.password !== req.body.password) {
                    res.json({success: false, message: 'Giriş başarısız.Şifre hatalı.'});
                }
                //sifre eslesirse
                else {

                    // token olusturuluyor
                    var token = jwt.sign(user, app.get('superSecret'), {
                        expiresIn: 86400 // expires in 24 hours
                    });

                    res.json({
                        success: true,
                        token: token
                    });
                }

            }

        });
    });

    app.post('/register', function(req, res){
        var newuser = new User({
            regID: req.body.regID,
            user_choice :""
        });

        newuser.save(function (err) {
            if (err) throw err;
            res.json({success: true, message: 'helloworld.'});
        });
    });

    apiRoutes.use(function (req, res, next) {

        // gelen token kontrol ediliyor
        var token = req.body.token || req.param('token') || req.headers['x-access-token'];


        if (token) {

         
            jwt.verify(token, app.get('superSecret'), function (err, decoded) {
                if (err) {
                    return res.json({success: false, message: 'Failed to authenticate token.'});
                } else {
                 
                    req.decoded = decoded;
                    next();
                }
            });

        } else {

            // gelen token yoksa hata doner
            return res.status(403).send({
                success: false,
                message: 'Erişim izni yok.'
            });

        }

    });

   var kullanicilar = {};

   io.sockets.on('connection', function (socket) { // tüm node işlemlerini kapsayan ana fonksiyon

        socket.on("insert_user", function (data) {
            User.findOne({username: data["username"]}, function (err, user) {

                if (err) throw err;

                if (user) socket.emit('new_chat', {"data": "Böyle bir kullanıcı bulunmaktadır."});
                else {
                    var newuser = new User({
                        username: data["username"],
                        password: data["password"]
                    });

                    newuser.save(function (err, userid) {
                        if (err) throw err;
                        var userID = userid._id;
                        socket.username = data["username"];
                        socket.userId = userID;
                        kullanicilar[data["username"]] = {
                            userName: data["username"],
                            userId: socket.userId
                        };
                        socket.emit("insert_user", newuser);
                    });
                }
            });
        });

        socket.on('login', function (data) {
            User.findOne({
                username: data["username"]
            }, function (err, user) {

                if (err) throw err;
                if (!user) {
                    res.json({success: false, message: 'Giriş başarısız.Kullanıcı bulunamadı.', userid: null});
                }   //boyle bir kullanici yoksa hata verir
                else if (user) {

                    // sifre eslesmezse
                    if (user.password !== data["password"]) {
                        res.json({success: false, message: 'Giriş başarısız.Şifre hatalı.', userid: null});
                    }
                    //sifre eslesirse
                    else {
                        socket.username = data["username"];
                        socket.userId = user._id;

                        kullanicilar[data["username"]] = {
                            userName : data["username"],
                            userId :  user._id
                        };
                        socket.emit("login", user);
                        console.log(kullanicilar);
                    }

                }

            });
        });

        function saveChatRoom(data) {

            var newChatLog = new ChatRoom({
                roomname: data["roomname"],
                user: [
                    {
                        username: data["username"],
                        userid: data["userid"]
                    }
                ]
            });
            newChatLog.save(function (err) {
                if (err) throw err;
                socket.emit('chatroom_created', newChatLog); //data id yi almalı
            });
        }

        socket.on('create_room', function (data) { //clientte'ki mesajı aldık

            saveChatRoom(data);
        });

        function loadChatRoom(data) {

            ChatRoom.find({$or: [{$or: [{"user.userid": data.userid}]}]}).sort({'timestamp': -1}).limit(5).exec(function (err, rooms) {
                if (err) throw err;
                if (rooms.length !== 0) {
                    var list = [];
                    rooms.reverse(); 
                    rooms.forEach(function (room) {
                        list.push(room["roomname"], room["_id"]);
                    });
                    socket.emit('load_room', list);

                }
            });
        }

        socket.on('load_room', function (data) { //clientte'ki mesajı aldık
            loadChatRoom(data);
        });

        function insertFriend(data) {
            User.findOne({username: data["username"]}, function (err, user) {

                if (err) throw err;

                if (!user) socket.emit('new_chat', {"data": "Böyle bir kullanıcı bulunmamaktadır."});
                else if (user) {
                    var userID = user._id;
                    ChatRoom.findById(data.roomid,
                        function (err, room) {
                            if (err) throw err;
                            else {
                                room.user.push({
                                    username: data.username,
                                    userid: userID
                                });
                                room.save(function (err) {

                                    if (err) {
                                        throw err;
                                    }
                                    else {
                                        socket.emit('new_chat', {"data": "Bir sohbet oluşturuldu"});

                                    }
                                });
                            }
                        });
                }
            });

        }

        socket.on('insert_friend', function (data) {
            insertFriend(data);

        });

        function saveMessage(data) {
            var mess = new Message({
                content: data["content"],
                username: data["username"],
                userid: data["userid"],
                roomid: data["roomid"]

            });
            mess.save(function (err) {
                if (err) throw err;
            });
        }

        socket.on('send_msg', function (data) {
            saveMessage(data);
            io.sockets.in(data["roomid"]).emit('send_msg', {"username":data["username"],"userid":data["userid"],"content":data["content"]});

        });

        socket.on("connect_room",function (data) {
            socket.join(data["roomid"]);
        });

        function selectUser(data) {
            ChatRoom.findById(data["roomid"],function (err,roominf) {
                 if(err) throw err;
                if (roominf.length !== 0) {

                    socket.emit('user_list',roominf["user"]);
                }
            });
        }

        socket.on("user_list",function (data) {
            selectUser(data);
        });

        function messageList(data) {

            Message.find({$or:[{"roomid":data["roomid"]}]},function (err,mess) {
                if(err) throw err;
                if(mess.length!==0) {

                  socket.emit('message_list',mess);
                }
            })
        }

        socket.on('message_list',function (data) {
            messageList(data);
        })

        socket.on('broadcast_msg',function (data) {
            saveMessage(data);
            io.sockets.emit('broadcast_msg', {"username":data["username"],"userid":data["userid"],"content":data["content"]});
        })

        socket.on("disconnect", function(){

            delete kullanicilar[socket.username];

             console.log(kullanicilar);
        });


    });
}

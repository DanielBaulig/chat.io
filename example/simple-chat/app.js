/*jshint laxcomma:true*/

var sio
  , chat
  , counter = 1
  , express = require('express')
  , http = require('http')
  , app = express();

app.configure(function () {
  app.use(express['static'](__dirname + '/public'));
});

app.get('/', function (req, res) {
  res.redirect('index.html');
});


server = http.createServer(app);
sio = require('socket.io').listen(server);
chat = require('../../lib/chat.io').createChat(sio.of('/chat'));

sio.configure(function () {
  sio.of('/chat').authorization(function (handshake, callback) {
    handshake.nickname = 'Guest' + counter++;
    callback(null, true);
  });
});

server.listen(8080);

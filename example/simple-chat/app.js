/*jshint laxcomma:true*/

var sio
  , chat
  , counter = 1
  , express = require('express')
  , app = express.createServer();

app.configure(function () {
  app.use(express['static'](__dirname + '/public'));
});

app.get('/', function (req, res) {
  res.redirect('index.html');
});


app.listen(8080);
sio = require('socket.io').listen(app);
chat = require('../../lib/chat.io').createChat(sio.of('/chat'));

sio.configure(function () {
  sio.of('/chat').authorization(function (handshake, callback) {
    handshake.nickname = 'Guest' + counter++;
    callback(null, true);
  });
});

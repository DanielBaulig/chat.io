/*jshint laxcomma:true, eqeqeq:true, undef:true, node:true, expr:true*/
/*global describe:true, it:true, before:true, beforeEach:true, afterEach*/

var ioc = require('socket.io-client')
  , io = require('socket.io')
  , Chat = require('../lib/chat.io.js')
  , should = require('should')
  , serverPort = 8080
  , options = { transports: ['websockets'], 'force new connection': true };
  
var server, chat;

function connectClient() {
  return ioc.connect('http://localhost:'+serverPort, options);
}

function setAuthorizationAs(user) {
  var i = 0;
  if (arguments.length > 1) {
    user = Array.prototype.slice.call(arguments);
  }
  server.set('authorization', function (handshake, accept) {
    if ('[object Array]' === Object.prototype.toString.call(user)) {
      handshake.nickname = user[i++];
      if (i > user.length) i = 0;
    } else {
      handshake.nickname = user;
    }
    accept(null, true);
  });
}


describe('chat.io', function () {
  beforeEach(function (done) {
    server = io.listen(serverPort, function () {
      chat = new Chat(server.sockets);
      done();
    });
  });
  afterEach(function (done) {
    server.server.close();
    chat.namespace.clients().forEach(function (c) {
      c.disconnect();
    });
    server.server.on('close', function () {
      done();
    });
  });
  describe('Chat', function () {
    describe('#on connection', function () {
      it('should be emitted when client connects', function (done) {
        setAuthorizationAs('User');
        var c = connectClient();
        chat.once('connection', function (nickname) {
          nickname.should.equal('User');
          done();
        });
      });
    });
    describe('#kick', function () {
      it('should disconnect a user', function (done) {
        setAuthorizationAs('User');
        var c = connectClient();
        chat.once('connection', function (nickname) {
          chat.kick(nickname);
        });
        c.on('disconnect', function (reason) {
          reason.should.equal('booted');
          done();
        });
      });
    });
    describe('#settings["channel join permission"]', function () {
      it('should prohibit channel join when set to false', function (done) {
        setAuthorizationAs('User');
        chat.settings['channel join permission'] = false;
        var c = connectClient();
        c.on('connect', function () {
          c.emit('join', 'aChannel', function (err) {
            should.exist(err);
            err.should.equal('Not permitted');
            done();
          });
        });
      });
      it('should be invoked for join permission if set to a function', function (done) {
        setAuthorizationAs('User');
        chat.settings['channel join permission'] = function (user, channel, allow) {
          user.should.equal('User');
          channel.should.equal('aChannel');
          allow(true);
        };
        var c = connectClient();
        c.on('connect', function () {
          c.emit('join', 'aChannel', function (err) {
            should.not.exist(err);
            chat.settings['channel join permission'] = function (user, channel, allow) {
              user.should.equal('User');
              channel.should.equal('otherChannel');
              allow(false);
            };
            c.emit('join', 'otherChannel', function (err) {
              should.exist(err);
              err.should.equal('Not permitted');
              done();
            });
          });
        });
      });
    });
    describe('#sendSystem', function () {
      it('should send a message to the entire system', function (done) {
        setAuthorizationAs('User');
        var c = connectClient(), c2 = connectClient(), first = true;
        c.on('message', function (message) {
          message.should.equal('Hello, World!');
          if (first) first = false;
          else done();
        });
        c2.on('message', function (message) {
          message.should.equal('Hello, World!');
          if (first) first = false;
          else done();
        });
        chat.on('connection', function () {
          if (first) first = false;
          else {
            first = true;
            chat.sendSystem('Hello, World!');
          }
        });
      });
    });
    describe('#sendChannel', function () {
      it('should send a message to a channel', function (done) {
        setAuthorizationAs('User');
        var c = connectClient(), c2 = connectClient(), first = true;
        c.on('connect', function () {
          this.emit('join', 'aChannel', function (err) {
            should.not.exist(err);
            chat.sendChannel('aChannel', 'Hello, Channel!');
          });
        });
        c2.on('connect', function () {
          this.emit('join', 'otherChannel', function (err) {
            should.not.exist(err);
            chat.sendChannel('otherChannel', 'Hello, other Channel!');
          });
        });
        c2.on('message', function (message) {
          message.should.equal('Hello, other Channel!');
          if (first) first = false;
          else done();
        });
        c.on('message', function (message) {
          message.should.equal('Hello, Channel!');
          if (first) first = false;
          else done();
        });
      });
    });
    describe('#sendUser', function () {
      it('should send a message to a specific user', function (done) {
        setAuthorizationAs('User', 'User2');
        var c = connectClient(), c2, first = true;
        c.on('connect', function ( ) {

          c2 = connectClient();
          c2.on('connect', function () {
            chat.sendUser('User2', 'Hello, other User!');
          });
          c2.on('message', function (message) {
            message.should.equal('Hello, other User!');
            if (first) first = false;
            else done();
          });

          chat.sendUser('User', 'Hello, User!');
        });
        c.on('message', function (message) {
          message.should.equal('Hello, User!');
          if (first) first = false;
          else done();
        });
      });
    });
    describe('#on whisper', function () {
      it('should relay a whisper message', function (done) {
        setAuthorizationAs(['User', 'User2']);
        var c = connectClient(), c2, first = true;
        c.on('connect', function () {
          c2 = connectClient();
        });
        c.on('whisper', function (from, message) {
          from.should.equal('User2');
          message.should.equal('Pssst, User!');
          done();
        });
        chat.on('connection', function (nickname) {
          if (first) {
            first = false;
          } else {
            c2.emit('whisper', 'User', 'Pssst, User!');
            chat.removeAllListeners('connection');
          }
        });
      });
      it('should inform if given user is not online', function (done) {
        setAuthorizationAs('User');
        var c = connectClient();
        c.on('connect', function () {
          c.emit('whisper', 'User2', 'Hello, User!', function (err) {
            should.exist(err);
            err.should.equal('Unknown user');
            done();
          });
        });
      });
    });
    describe('#on join', function () {
      it('should join the given channel', function (done) {
        setAuthorizationAs('User');
        var c = connectClient();
        c.on('message', function (message) {
          message.should.equal('Hello, Channel!');
          done();
        });
        chat.once('connection', function () {
          c.emit('join', 'aChannel', function (err) {
            should.not.exist(err);
            chat.sendChannel('aChannel', 'Hello, Channel!');
          });
        });
      });
      it('should inform others on the channel about the join', function (done) {
        setAuthorizationAs(['User', 'User2']);
        var c = connectClient(), c2;
        c.on('join', function (user) {
          user.should.equal('User2');
          done();
        });
        c.on('connect', function () {
          c2 = connectClient();
        });
        chat.once('connection', function () {
          c.emit('join', 'aChannel', function (err) {
            should.not.exist(err);
            c2.emit('join', 'aChannel', function (err) {
              should.not.exist(err);
            });
          });
        });
      });
      it('should not join the lobby', function (done) {
        setAuthorizationAs('User');
        var c = connectClient();
        c.on('connect', function () {
          c.emit('join', 'aChannel', function (err) {
            should.not.exist(err);
            c.emit('join', chat.settings.lobby, function (err) {
              should.exist(err);
              err.should.equal('Can\'t join lobby, please leave room instead');
              done();
            });
          });
        });
      });
    });
    describe('#on say', function () {
      it('should relay the message to other users on the same channel', function (done) {
        setAuthorizationAs(['User', 'User2']);
        var c = connectClient(), c2, first = true;
        c.on('connect', function () {
          c2 = connectClient();
          c2.on('say', function (from, message) {
            from.should.equal('User2');
            message.should.equal('Hello, Others!');
            if (first) {
              first = false;
            } else {
              done();
            }
          }); 
        });
        c.on('say', function (from, message) {
          from.should.equal('User2');
          message.should.equal('Hello, Others!');
          if (first) {
            first = false;
          } else {
            done();
          }
        });
        chat.on('connection', function (nickname) {
          if (first) {
            first = false;
          } else {
            first = true;
            c2.emit('say', 'Hello, Others!');
          }
        });
      });
      it('should not relay the message to users on other channels', function (done) {
        setAuthorizationAs('User', 'User2');
        var c = connectClient(), c2, first = true;
        c.on('say', function (user, message) {
          user.should.equal('User');
          message.should.equal('Hello, Lobby!');
          if (first) first = false;
          else done();
        });
        c.on('connect', function () {
          c2 = connectClient();
          c2.on('say', function (user, message) {
            user.should.equal('User2');
            message.should.equal('Hello, Channel!');
            if (first) first = false;
            else done();
          });
          c2.on('connect', function () {
            c.emit('join', 'aChannel', function (err) {
              should.not.exist(err);
              c.emit('say', 'Hello, Lobby!');
              c2.emit('say', 'Hello, Channel!');
            });
          });
        });
      });
    });
    describe('#on leave', function () {
      it('should leave a channel', function (done) {
        setAuthorizationAs('User');
        var c = connectClient();
        c.on('message', function (message) {
          message.should.equal('Hello, Channel!');
          c.emit('leave', function (err) {
            should.not.exist(err);
            chat.channel('aChannel').length.should.eql(0);
            done();
          });
        });
        chat.once('connection', function () {
          c.emit('join', 'aChannel', function (err) {
            should.not.exist(err);
            chat.sendChannel('aChannel', 'Hello, Channel!');
          });
        });
      });
      it('should join the lobby', function (done) {
        setAuthorizationAs('User');
        var c = connectClient();
        c.on('message', function (message) {
          message.should.equal('Hello, Channel!');
          c.emit('leave', function (err) {
            should.not.exist(err);
            chat.channel(chat.settings.lobby).length.should.eql(1);
            done();
          });
        });
        chat.once('connection', function () {
          c.emit('join', 'aChannel', function (err) {
            should.not.exist(err);
            chat.sendChannel('aChannel', 'Hello, Channel!');
          });
        });
      });
    });
  });
});

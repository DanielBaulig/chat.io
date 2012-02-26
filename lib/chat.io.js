/*jshint eqeqeq:true, proto:true, laxcomma:true, undef:true, node:true, expr: true*/
/* chat.io
 * (c) 2012 Daniel Baulig <daniel.baulig@gmx.de>
 * MIT Licensed
 */

var EventEmitter = process.EventEmitter
  , channelPrefix = '#'
  , userPrefix = '@'
  , first = require('first');

// hack until socket.disconnect is fixed
function disconnect(socket) {
  if (socket.namespace.name === '') return socket.disconnect();
  socket.packet({type:'disconnect'});
  socket.manager.onLeave(socket, socket.namespace.name);
  socket.$emit('disconnect', 'booted');
}

function Chat(namespace, options) {
  options = options || {};
  this.namespace = namespace;
  this.settings = {
    lobby: '',
    'channel join permission': true,
    'handshake nickname property': 'nickname'
  };

  for (var o in options) {
    this.settings[o] = options[o];
  }

  function onWhisper(target, message, ack) {
    this.get('nickname', function (err, nickname) {
      if (err || !nickname) return ack && ack('Internal error');

      if (namespace.clients(userPrefix + target).length) {
        namespace.to(userPrefix + target).emit('whisper', nickname, message);
      } else ack && ack('Unknown user');
    });
  }

  var chat = this;

  function onSay(message) {
    var socket = this;

    first(function () {
      socket.get('nickname', this);
    }).whilst(function () {
      socket.get('channel', this);
    }).then(function (nick, chan) {
      if (nick[0] || chan[0] || !nick[1]) return;

      namespace.to(channelPrefix + chan[1]).emit('say', nick[1], message);
    });
  }

  function onChannelJoin(channel, ack) {
    var socket = this;

    if (!chat.settings['channel join permission']) return ack && ack('Not permitted');
    if (chat.settings.lobby === channel) return ack && ack('Can\'t join lobby, please leave room instead');

    first(function () {
      socket.get('nickname', this);
    }).whilst(function () {
      socket.get('channel', this);
    }).then(function (nick, chan) {
      var errnick = nick[0]
        , nickname = nick[1]
        , errchannel = chan[0]
        , oldchannel = chan[1];

      if (errnick || errchannel || !nickname) return ack && ack('Internal error');

      function onJoinAllow(allow) {
        if (!allow) return ack && ack('Not permitted');

        if (null !== oldchannel) {
          socket.leave(channelPrefix + oldchannel);
          if (oldchannel !== chat.settings.lobby)
            socket.broadcast.to(channelPrefix + oldchannel).emit('leave', nickname);
        }
        socket.join(channelPrefix + channel);
        socket.set('channel', channel, function (err) {
          if (ack) ack(err && 'Can\'t change channel');
          if (err) {
            socket.log.warn('error joining', channel, 'with', err, 'for client', socket.id);
            onLeave.call(socket);
          } else socket.broadcast.to(channelPrefix + channel).emit('join', nickname);
        });
      }

      if ('function' === typeof chat.settings['channel join permission']) {
        chat.settings['channel join permission'](nickname, channel, onJoinAllow);
      } else {
        onJoinAllow.call(undefined, true);
      }
    });

  }

  function onLeave(ack) {
    var socket = this;

    first(function () {
      socket.get('nickname', this);
    }).whilst(function () {
      socket.get('channel', this);
    }).then(function (nick, chan) {
      var errnick = nick[0]
        , nickname = nick[1]
        , errchannel = chan[0]
        , channel = chan[1];

      if (errnick || errchannel || !nickname) return ack && ack('Internal error');

      if (chat.lobby !== channel) {
        socket.leave(channelPrefix + channel);
        socket.broadcast.to(channelPrefix + channel).emit('leave', nickname);
      }
      socket.join(channelPrefix + chat.settings.lobby);
      socket.set('channel', chat.settings.lobby, function (err) {
        if (ack) ack(err && 'Can\'t join lobby');
        if (err) {
          socket.log.warn('error joining lobby with', err, 'for client', socket.id);
          // state of this connection is not healthy anymore
          disconnect(socket);
        }
      });
    });

  }

  namespace.on('connection', function (socket) {
    var nickname = socket.handshake[chat.settings['handshake nickname property']];
 
    // we cannot handle clients without nicknames
    if (!nickname) {
      socket.log.warn('no nickname given for client', socket.id);
      return disconnect(socket);
    }

    socket.join(userPrefix + nickname);

    socket.on('whisper', onWhisper);
    socket.on('say', onSay);
    socket.on('join', onChannelJoin);
    socket.on('leave', onLeave);
    
    socket.set('nickname', nickname, function (err) {
      if (err) {
        socket.send('Can\'t set nickname');
        socket.log.warn('error setting nickname', nickname, 'with', err, 'for client', socket.id);
        disconnect(socket);
        return; 
      } else {
        // join lobby
        onLeave.call(socket, function (err) {
          if (err) {
            return;
          } 
          chat.emit('connection', nickname);
        });
      }
    });

  });
}

Chat.createChat = function (sio, options) {
  return new Chat(sio, options);
};

Chat.prototype.__proto__ = EventEmitter.prototype;

Chat.prototype.kick = function (nickname) { 
  this.user(nickname).forEach(function (v) {
    disconnect(v);
  });
  return this;
};

Chat.prototype.sendChannel = function (channel, message) {
  this.namespace.to(channelPrefix+channel).send(message);
  return this;
};

Chat.prototype.sendSystem = function (message) {
  this.namespace.send(message);
  return this;
};

Chat.prototype.sendUser = function (nickname, message) {
  this.namespace.to(userPrefix + nickname).send(message);
  return this;
};

Chat.prototype.user = function (nickname) {
  return this.namespace.clients(userPrefix +  nickname);
};

Chat.prototype.channel = function (channel) {
  return this.namespace.clients(channelPrefix + channel);
};

Chat.prototype.set = function (key, value) {
  this.namespace.settings[key] = value;
  return this;
};

Chat.prototype.get = function (key) {
  return this.namespace.settings[key];
};

module.exports = Chat;


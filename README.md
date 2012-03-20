# _chat.io_

chat.io is a simple socket.io based chat solution.

Example:

See [example/simple-chat/](./example/simple-chat/).

# Installation

    npm install chat.io

# Features

  * [Easy to use](#etu)
  * [socket.io namespace compliant](#namespace)
  * [Channels](#channels)
  * [Whisper](#whisper)
  * [Kicking](#kick)
  * [Channel permission system](#perm)
  * [Server messages](#servermsg)

## <a name="etu" /> Easy to use

Server:

    require('chat.io').createChat(io.sockets);

    var guestCounter = 0;
    io.set('authorization', function (handshake, accept) {
        return accept(null, handshake.nickname = 'Guest'+ ++guestCounter);
    });

Client:

    var socket = io.connect('http://localhost');

    socket.on('say', function (user, message) {
        messages.append(user+'> '+message);
    });

## <a name="namespace" />socket.io namespace compliant

Server:

    require('chat.io').createChat(io.of('/chat'));

    var guestCounter = 0;
    io.of('/chat').authorization(function (handshake, accept) {
        return accept(null, handshake.nickname = 'Guest'+ ++guestCounter);
    });

Client:
    
    var socket = io.connect('http://localhost/chat');

## <a name="channels" />Channels

Client:

    // beeing notified
    socket.on('join', function (user) {
        message.append(user + ' joined your channel.');
    });

    // joining
    socket.emit('join', 'aChannel', function (err) {
        if (err) messages.append('Error joining aChannel: ' + err);
    });

## <a name="whisper" />Whisper

Client:

    // receiving
    socket.on('whisper', function (user, message) {
        messages.append('<i>from '+user+'> '+message+'</i>');
    });
    
    // sending
    socket.emit('whisper', 'aUser', 'Hello, aUser!', function (err) {
        if (err) messages.append('Error whipering aUser: '+err);
    });

## <a name="kick" />Kicking

Server:

    chat.on('connection', function (nickname) {
        if ('badyGuy' === nickname)  {
            chat.kick(nickname);
        }
    });

## <a name="perm" />Channel permission system

Server:

    // deactivate channel switching
    chat.set('channel join permission', false);

    // permission callback
    chat.set('channel join permission', function (user, channel, allow) {
        if ('operator' === user) {
            return allow(true);
        }
        if ('secret' === channel) {
            return allow(false);
        }
        return allow(true);
    });

## <a href="servermsg" />Server messages

Client:

    socket.on('message', function (message) {
        messages.append(message);
    });

Server:

    // global messages
    chat.sendSystem('Server shutting down in 10 minutes.');

    // channel messages
    chat.sendChannel(aChannel, 'This channel is supervised. Please behave.');

    // user messages
    chat.sendUser(aUser, 'This is your first visit, please read the guidelines.');

# Documentation

For now, please see the example and the source code for additional documentation.

# Tests

    make test

# License

Copyright (c) 2012 Daniel Baulig daniel.baulig@gmx.de

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

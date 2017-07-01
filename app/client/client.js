var socket = require('socket.io-client')('http://127.0.0.1');
socket.on('connect', function(){
    console.log('connect');
});
socket.on('event', function(data){});
socket.on('disconnect', function(){});
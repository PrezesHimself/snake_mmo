const express = require('express');
const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const _ = require('lodash');
var game;
var debug;

app.use('/', express.static('./app/public'))

io.on('connection', function(socket){

    socket.on('joinGame', function(snake){
        game.addSnake(snake);
    });

    socket.on('directionChanged', function(direction){
        debug.log(`${direction.snake.name} has moved ${direction.direction}`);

        var snake = _.find(game.snakes, {name: direction.snake.name});

        if(snake) snake.direction = direction.direction;
    });
});



http.listen(process.env.PORT || 5000, function(){
    console.log(`listening on *:${process.env.PORT || 5000}`);
});


(function () {
    'strict mode'
    global.DEBUG = {};

    global.DEBUG.Debug = function Debug(io, config) {

        this.log = log;

        function log(msg) {
            io.sockets.emit('debug_log', msg);
        }

    };

})();

(function () {
    'strict mode'
    global.GAME = {};

    global.GAME.Game = Game;

    function Game(io, debug) {
        this.io = io;
        this.debug = debug;

        this.snakes = [];

        this.options = {
            fps: 15
        };
        this.state = {};
    };
    
    Game.prototype.start = function (event) {
        this.gameLoop();
    };

    Game.prototype.getState = function () {
        var state = _.reduce(this.snakes, function (sum, n) {
            return `${sum} ${n.name} is on x: ${n.x} y: ${n.y}`;
        }, '');

        return state;
    };

    Game.prototype.getStateObj = function () { //change that to class
        var state = {};
        state.snakes = this.snakes;
        return state;
    };

    Game.prototype.addSnake = function (snake) {
        this.debug.log(snake.name + ' joined the game');
        this.snakes.push(new Snake(snake.name));
    };

    Game.prototype.broadcastSocket = function (event, payload) {
        this.io.sockets.emit(event, payload);
    };

    Game.prototype.update = function () {
        _.each(this.snakes, function (snake) {
            snake.update();
        })
    }

    Game.prototype.gameLoop = function () {
        const _self = this;

        this.update();

        this.broadcastSocket('game_gameLoop', this.getStateObj());
        this.debug.log(this.getState());

        setTimeout(function(){
            _self.gameLoop();
        }, 1000 / this.options.fps);
    };
    
//    snake

    function Snake(name) {
        this.x = _.sample([10, 20, 30, 40]);
        this.y = _.sample([10, 20, 30, 40]);
        this.name = name;
        this.direction = 'right';
    }

    Snake.prototype.update = function () {
        switch (this.direction) {
            case 'up':
                this.y -= 1;
                break;
            case 'down':
                this.y += 1;
                break;
            case 'left':
                this.x -= 1;
                break;
            case 'right':
                this.x += 1;
                break;
        }

        if(this.y < 0) this.y = global.GRID.height;
        if(this.y > global.GRID.height) this.y = 0;
        if(this.x < 0) this.x = global.GRID.width;
        if(this.x > global.GRID.width) this.x = 0;

    }

//    grid 
    global.GRID = new Grid();

    function Grid() {
        this.width = 67;
        this.height = 67;
    }

})();


debug = new DEBUG.Debug(io);
game = new global.GAME.Game(io, debug);
game.start();
const express = require('express');
const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const _ = require('lodash');
var game;
var debug;

const colorArr = ['#cc0000','#ffcc00','#33cc33','#0099ff','#cc33ff'];


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
        var _self = this;

        var collisions = this.checkCollisions();
        _.each(collisions, function (snake) {
            snake.reset();
            _self.broadcastSocket('sound_play', 'crash1')
        });
        _.each(this.snakes, function (snake) {
            snake.update();
        });
    };

    Game.prototype.checkCollisions = function () {
        var collidedSnakes = [];
        var flatSegmentsMap = _(this.snakes)
            .map('segments')
            .flatten()
            .value();

        _.each(this.snakes, function (snake) {
            _.each(flatSegmentsMap, function (segment) {
                if(snake.checkCollision(segment)) {
                    collidedSnakes.push(snake);
                };
            });
        });
        return collidedSnakes;
    };

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

        this.head;
        this.name = name;

        this.color = colorArr.length > 0 ? colorArr.pop() : Math.random().toString(16).slice(-6); //todo extract to external fn
        this.direction = 'right';

        this.reset();
    }

    Snake.prototype.reset = function () {

        this.segments = [];
        this.length = 25;
        this.x = _.sample([10, 20, 30, 40]);
        this.y = _.sample([10, 20, 30, 40]);
    };

    Snake.prototype.update = function () {
        this.segments.push(new Segment(
            this.x, this.y
        ));

        if(this.segments.length === this.length) {
            this.segments.shift();
        }


        this.head = _.last(this.segments);

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

    Snake.prototype.checkCollision = function(segment){
        if(this.head == segment) return false;
        return this.x === segment.x && this.y === segment.y;
    };

// segment

    function Segment(x, y) {
        this.x = x;
        this.y = y;
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
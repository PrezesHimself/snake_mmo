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
        debug.log(`${direction.snake.id} has moved ${direction.direction}`);

        var snake = _.find(game.snakes, {id: direction.snake.id});
        console.log(snake, direction.snake.id);
        if(snake) snake.direction = direction.direction;
    });

    socket.on('disconnect', function () {
        io.emit('user disconnected');
        game.removeSnake(socket.id);
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
        this.foods = [];

        this.options = {
            fps: 15
        };
        this.state = {};
    };
    
    Game.prototype.start = function (event) {
        this.addFood();
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
        state.foods = this.foods;
        return state;
    };

    Game.prototype.addSnake = function (snake) {
        // this.debug.log(snake.name + 'id:'+ snake.id + ' joined the game');
        console.log(snake, 'test');
        this.snakes.push(new Snake(snake.id, snake.name));
    };

    Game.prototype.removeSnake = function (snakeId) {
        var snakeToBeRemoved = _.find(this.snakes, {id: snakeId});
        _.pull(this.snakes, snakeToBeRemoved);
        // this.debug.log(snakeToBeRemoved.name + 'id:'+ snakeToBeRemoved.id + 'index:'+snakeIndex+ ' left the game');
    };

    Game.prototype.broadcastSocket = function (event, payload) {
        this.io.sockets.emit(event, payload);
    };

    Game.prototype.update = function () {
        var _self = this;

        _.each(this.checkCollisions(), function (collision) {
            var snake = collision.a;
            if(collision.b.constructor.name === 'Segment') {
                snake.reset();
            } else if(collision.b.constructor.name === 'Food') {
                _self.removeFood(collision.b);
                _self.addFood();
                snake.eat();
            }
        });
        _.each(this.snakes, function (snake) {
            snake.update();
        });
    };

    Game.prototype.removeFood = function (food) {
        _.remove(this.foods, food);
    };

    Game.prototype.addFood = function () {
        this.foods.push(new Food());
    };

    Game.prototype.checkCollisions = function () {
        var collisions = [];
        var flatSegmentsMap = _(this.snakes)
            .map('segments')
            .flatten()
            .value()
            .concat(this.foods);

        _.each(this.snakes, function (snake) {
            _.each(flatSegmentsMap, function (object) {
                if(snake.checkCollision(object)) {
                    collisions.push({a: snake, b: object});
                };
            });
        });
        return collisions;
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

    function Snake(id, name) {
        this.head;
        this.name = name;
        this.id = id;

        this.color = colorArr.length > 0 ? colorArr.pop() : Math.random().toString(16).slice(-6); //todo extract to external fn
        this.direction = 'right';

        this.reset();
    }

    Snake.prototype.reset = function () {

        this.segments = [];
        this.length = 5;
        this.x = _.sample([10, 20, 30, 40]);
        this.y = _.sample([10, 20, 30, 40]);
    };

    Snake.prototype.eat = function () {
        this.length++;
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

// food

    function Food() {
        this.x = _.sample(_.range(67));
        this.y = _.sample(_.range(67));
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
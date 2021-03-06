const express = require('express');
const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const _ = require('lodash');
const size = 67;
var game;
var debug;

const colorArr = ['#cc0000','#ffcc00','#33cc33','#0099ff','#cc33ff'];

app.use('/', express.static('./app/public'))

io.on('connection', function(socket){

    socket.on('joinGame', function(snake){
        game.addSnake(snake);
        socket.emit('game_updateScore', game.getScoreBoard());
    });

    socket.on('directionChanged', function(direction){
        if(!direction) {
            return;
        }
        debug.log(`${direction.snake.id} has moved ${direction.direction}`);

        var snake = _.find(game.snakes, {id: direction.snake.id});
        if(snake) snake.direction = direction.direction;
    });

    socket.on('disconnect', function () {
        io.emit('user disconnected');
        var snake = _.find(game.snakes, {id: socket.id});
        if(snake) game.removeSnake(snake);
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
        this.powerups = [];

        this.timer = new Timer();

        this.options = {
            fps: 15
        };
        this.state = {};

        this.colorFactory = new ColorFactory();
    };
    
    Game.prototype.start = function (event) {
        var _self = this;
        this.addFood();
        this.gameLoop();

        // this.timer.repeat(30, function () {
        //     _self.span(new Explosion());
        // });
    };

    Game.prototype.getState = function () {
        var state = _.reduce(this.snakes, function (sum, n) {
            return `${sum} ${n.name} is on x: ${n.x} y: ${n.y}`;
        }, '');

        return state;
    };

    Game.prototype.span = function (entity) {
        this.powerups.push(entity);
    };

    Game.prototype.getStateObj = function () { //change that to class
        var state = {};
        state.snakes = this.snakes;
        state.foods = this.foods;
        state.powerups = this.powerups;
        return state;
    };

    Game.prototype.addSnake = function (snake) {
        // this.debug.log(snake.name + 'id:'+ snake.id + ' joined the game');
        this.snakes.push(new Snake(snake.id, snake.name, this.colorFactory.getColor()));
        this.broadcastSocket('playNewplayer');
    };

    Game.prototype.removeSnake = function (snake) {
        _.pull(this.snakes, snake);
        this.colorFactory.returnColor(snake.color);
        // this.debug.log(snakeToBeRemoved.name + 'id:'+ snakeToBeRemoved.id + 'index:'+snakeIndex+ ' left the game');
    };

    Game.prototype.broadcastSocket = function (event, payload) {
        this.io.sockets.emit(event, payload || '');
    };

    Game.prototype.getScoreBoard = function () {
        var scoreBoard = _.map(this.snakes, function (snake) {
            return {
                name: snake.name,
                score: snake.length,
                color: snake.color
            };
        });
        scoreBoard = _.orderBy(scoreBoard, ['score'], ['desc']);

        var highScore = _.chain(scoreBoard)
            .concat(this.state.highScore)
            .reject(function (item) {
                return !item;
            })
            .orderBy(['name', 'score'], ['asc', 'desc'])
            .uniqBy('name')
            .orderBy(['score'], ['desc'])
            .take(3)
            .value();

        this.state.highScore = highScore;
        return {
            scoreBoard: scoreBoard,
            highScore: highScore
        };
    };

    Game.prototype.update = function () {
        var _self = this;

        // var collisions = [];
        var collisions = this.checkCollisions();
        _.each(collisions, function (collision) {
            var snake = collision.a;
            if(collision.b.constructor.name === 'Segment') {
                snake.reset();
            } else if(collision.b.constructor.name === 'Food') {
                _self.removeFood(collision.b);
                if(!_self.foods.length) _self.addFood();

                snake.eat();
            } else if(collision.b.constructor.name === 'Explosion') {
                collision.b.action(_self);
                _self.removePowerup(collision.b);

            }
        });

        if(_.includes(this.getCollisionsTypes(collisions), 'Segment')) {
            _self.broadcastSocket('playCrash');
        }

        if(_.includes(this.getCollisionsTypes(collisions), 'Food')) {
            _self.broadcastSocket('playPowerup');
        }

        if(collisions.length) {
            _self.broadcastSocket('game_updateScore', _self.getScoreBoard());
        }
        _.each(this.snakes, function (snake) {
            snake.update();
        });

    };

    Game.prototype.getCollisionsTypes = function(collisions) {
        return _.chain(collisions)
            .map(function (collision) {
                return collision.b;
            })
            .map(function (target) {
                return target.constructor.name;
            })
            .uniq()
            .value();
    };

    Game.prototype.removeFood = function (food) {
        _.remove(this.foods, food);
    };

    Game.prototype.removePowerup = function (powerup) {
        _.remove(this.powerups, powerup);
    };

    Game.prototype.addFood = function (x, y) {
        this.foods.push(new Food(x, y));
    };

    Game.prototype.checkCollisions = function () {
        var collisions = [];
        var flatSegmentsMap = _(this.snakes)
            .map('segments')
            .flatten()
            .value()
            .concat(this.foods)
            .concat(this.powerups);

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

    function Snake(id, name, color) {
        this.head;
        this.name = name;
        this.id = id;

        this.color = color;
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
        this.length = this.length + 3;
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

    function Food(x, y) {
        this.x = x || _.sample(_.range(size));
        this.y = y || _.sample(_.range(size));
    }

// Explosion

    function Explosion() {
        this.x = _.sample(_.range(size));
        this.y = _.sample(_.range(size));
    }

    Explosion.prototype.action = function (game) {
        var offset = 3;
        game.addFood(this.x - offset, this.y - offset);
        game.addFood(this.x, this.y - offset);
        game.addFood(this.x + offset, this.y - offset);
        game.addFood(this.x + offset, this.y);
        game.addFood(this.x + offset, this.y + offset);
        game.addFood(this.x, this.y + offset);
        game.addFood(this.x - offset, this.y + offset);
        game.addFood(this.x - offset, this.y);
    };

//    grid 
    global.GRID = new Grid();

    function Grid() {
        this.width = size;
        this.height = size;
    }

//    Timer

    function Timer() {
        this.timers = [];
    }

    Timer.prototype.repeat= function(sec, callback) {
        var stop = false;
        var repeat = function() {
            setTimeout(
                function () {
                    callback();
                    if(!stop) repeat();
                },
                sec * 1000
            );
        };
        repeat();
        this.timers.push({
            callback: callback,
            repeat: repeat
        });
    };

//    ColorFactory

    function ColorFactory() {
        var colors = [
            '#f2b6b6',
            '#660e00',
            '#e53d00',
            '#e59173',
            '#734939',
            '#bf6600',
            '#33210d',
            '#ffc480',
            '#d9bfa3',
            '#73561d',
            '#a68500',
            '#ffee00',
            '#61661a',
            '#bcbf8f',
            '#d4ff80',
            '#40ff40',
            '#608060',
            '#008011',
            '#104016',
            '#80ffd4',
            '#00d6e6',
            '#007780',
            '#8fbcbf',
            '#566d73',
            '#102940',
            '#669ccc',
            '#3677d9',
            '#3d3df2',
            '#0c0059',
            '#413366',
            '#986cd9',
            '#70008c',
            '#e600d6',
            '#ffbff2',
            '#a6296c',
            '#330d21',
            '#664d5a',
            '#a6002c',
            '#ff80a2',
            '#cc0000',
            '#ffcc00',
            '#33cc33',
            '#0099ff',
            '#cc33ff'

    ];

        this.getColor = function () {
            return colors.pop() || '#FFF';
        }

        this.returnColor = function (color) {
            return colors.push(color);
        }
    }

})();


debug = new DEBUG.Debug(io);
game = new global.GAME.Game(io, debug);
game.start();
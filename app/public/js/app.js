
(function () {
    'strict mode'
    window.DEBUG = new Debug(
        $(".debug")
    );

    function Debug(element, config) {
        var _self = this;

        this.log = log;
        this.listen = listen;
        
        
        function listen(socket) {
            socket.on('debug_log', function (msg) {
                _self.log(msg);
            });
        }
        
        function log(msg) {
            element.prepend(
                createElement(msg)
            )
        }

        function createElement(msg) {
            return $('<div>').text(moment().format('MMMM Do YYYY, h:mm:ss a') + ' ' + msg);
        }

    };

})();


function Game(canvas, socket, name, ricky) {
    this.canvas = canvas;
    this.socket = socket;
    this.name = name;
    this.context = canvas.getContext('2d');

    this.options = {
        fps: 5
    };

    this.state = {};

    this.soundtrack = window.SOUNDS.playSound('rick');


    socket.on('game_gameLoop', this.gameLoop.bind(this));
    socket.on('game_updateScore', this.updateScoreBoard.bind(this));

    socket.on('playCrash', function () {
        window.SOUNDS.playCrash();
    });

    socket.on('playPowerup', function () {
        window.SOUNDS.playSound('powerup');
    });

    socket.on('playNewplayer', function () {
        window.SOUNDS.playSound('new_player');
    });

    $(ricky).click((function () {
        this.soundtrack.volume = this.soundtrack.volume ? 0 : 1;
        $(ricky).toggleClass('h');
    }).bind(this));
}


Game.prototype.updateScoreBoard = function (scoreBoard) {
    var board = $('.score-board');
    board.empty();
    _.each(scoreBoard.scoreBoard, function (score) {
        var element = $('<div>').text(score.name + ': ' + score.score);
        element.css('color', score.color)
        board.append(element);
    });
    board.append($('<h2>').text('High Score'));

    _.each(scoreBoard.highScore, function (score) {
        var element = $('<div>').text(score.name + ': ' + score.score);
        board.append(element);
    });
};

Game.prototype.start = function () {
    this.keyBindings();
};


Game.prototype.stop = function() {
    this.pause = true;
};


Game.prototype.scale = function () {
    this.ratio = innerWidth < innerHeight ? innerWidth : innerHeight;
    this.tile = (this.ratio / 10) | 0;
    this.grid = this.ratio / this.tile;

    this.canvas.width = this.canvas.height = this.ratio;
};


Game.prototype.addEntity = function (entity) {
    this.entities.push(entity);
};

Game.prototype.emitSocket = function (event, msg) {
    msg.snake = {};
    msg.snake.name = this.name;
    msg.snake.id = this.socket.id;
    this.socket.emit(event, msg);
};


Game.prototype.collide = function(a, b){
    return a.x === b.x && a.y === b.y;
};


Game.prototype.keyBindings = function () {
    var that = this;

    // define some keys
    var keys = {
        a: 65,
        left: 37,
        d: 68,
        right: 39,
        w: 87,
        up: 38,
        s: 83,
        down: 40,
        m: 77
    };


    document.onkeydown = function (e) {
        console.log(e);
        switch ((e.which || e.keyCode) | 0) {
            case keys.a:
            case keys.left:
                if (that.key !== 'right') {
                    that.key = 'left';
                    that.emitSocket('directionChanged', { direction: 'left'});
                }
                break;

            case keys.d:
            case keys.right:
                if (that.key !== 'left') {
                    that.key = 'right';
                    that.emitSocket('directionChanged', { direction: 'right'});
                }
                break;

            case keys.w:
            case keys.up:
                if (that.key !== 'down') {
                    that.key = 'up';
                    that.emitSocket('directionChanged', { direction: 'up'});
                }
                break;

            case keys.s:
            case keys.down:
                if (that.key !== 'up') {
                    that.key = 'down';
                    that.emitSocket('directionChanged', { direction: 'down'});
                }
                break;
            case keys.m:
                that.soundtrack.volume = that.soundtrack.volume ? 0 : 1;
        }
    };

};


Game.prototype.gameLoop = function (state) {
    this.state = state;
    this.draw();
};

/**
 * draw
 */
Game.prototype.draw = function () {
    var _self = this;


    this.context.fillStyle = '#000';
    this.context.globalAlpha   = 1;
    this.context.fillRect(
        0, 0, this.canvas.width, this.canvas.height);
    this.context.globalAlpha   = 1;

    _.each(this.state.snakes, function (snake) {
        var grid = _self.grid;
        _.each(snake.segments, function (segment, i) {
            // _self.context.globalAlpha = i/snake.segments.length + 0.5;
            _self.context.fillStyle = snake.color;
            _self.context.fillRect(
                segment.x * grid,
                segment.y * grid,
                grid, grid);
        })
    });

    _.each(this.state.foods, function (food) {
        var grid = _self.grid;

        _self.context.fillStyle = '#FFF';
        _self.context.fillRect(
            food.x * grid,
            food.y * grid,
            grid, grid);
    });

    _.each(this.state.powerups, function (powerup) {
        var grid = _self.grid;

        _self.context.fillStyle = '#F00';
        _self.context.fillRect(
            powerup.x * grid,
            powerup.y * grid,
            grid, grid);
    });
};

init();

function init() {
    var savedName = window.COOKIES.readCookie('PalaceJamUserName');
    if(savedName)  $('.snake-name').val(savedName);
}

$('.snake-name-button').click(function () {
    initGame();
});

$(document).keypress(function (e) {
    if (e.which == 13) {
        initGame();
        return false;
    }
});

function initGame() {
    $('.splash').toggle();
    var name = $('.snake-name').val();
    window.COOKIES.createCookie('PalaceJamUserName', name);
    var socket = io();
    
    socket.on('connect', function () {
        var snakeId = socket.id;
        DEBUG.listen(socket);
        socket.emit('joinGame', {id: snakeId, name: name});
    });

    var gameContainer = document.createElement("div");
    gameContainer.classList.add('game-container')

    var scoreBoard = document.createElement("div");
    scoreBoard.classList.add('score-board')

    var ricky = document.createElement("div");
    ricky.classList.add('ricky')

    var canvas = document.createElement("canvas");

    gameContainer.appendChild(canvas);
    gameContainer.appendChild(scoreBoard);
    gameContainer.appendChild(ricky);


    document.body.appendChild(gameContainer);

    var game = new Game(canvas, socket, name, ricky);
    game.scale();
    game.start();
}
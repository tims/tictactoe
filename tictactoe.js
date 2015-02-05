var readline = require('readline');
var _ = require('lodash');
var EventEmitter = require('events').EventEmitter;


var Board = function () {
  var board = [[null, null, null], [null, null, null], [null, null, null]];
  return {
    boardArray: function () {
      return _.cloneDeep(board);
    },
    dimensions: {x: board[0].length, y: board.length},

    setToken: function (token, x, y) {
      if (x < 0 || x >= board[0].length) throw 'x value out of bounds: ' + x;
      if (y < 0 || y >= board.length) throw 'y value out of bounds: ' + y;
      if (board[y][x]) throw 'position x,y=' + x + ',' + y + ' is already occupied';
      board[y][x] = token;
    },

    checkWinner: function (token) {
      function check_line(line) {
        return _.reduce(line, function (matches, cell) {
          return matches && (cell === token);
        }, true);
      }

      // check rows
      var matches = _.reduce(board, function (matches, row) {
        return matches || check_line(row)
      }, false);
      // check columns
      matches = _.reduce(_.range(board.length), function (matches, i) {
        var column = _.map(board, function (row) {
          return row[i]
        });
        return matches || check_line(column);
      }, matches);
      // check diagonals
      matches = matches || check_line(_.map(board, function (row, i) {
        return row[i];
      }));
      matches = matches || check_line(_.map(board, function (row, i) {
        return row[row.length - (i + 1)];
      }));

      return matches
    },
    checkDraw: function () {
      return _.reduce(_.flatten(board), function (isFull, cell) {
        return isFull && cell;
      }, true)
    }
  }
};

var BoardView = function (board, overlay) {
  function seperate(array, seperator) {
    var result = [];
    _.each(array, function (element, index) {
      if (index !== 0) result.push(seperator);
      result.push(element);
    });
    return result;
  }

  return {
    view: function () {
      var boardArray = board.boardArray();
      var overlayBoardArray = overlay ? overlay.boardArray() : null;
      var lines = _.map(boardArray, function (row, i) {
        row = _.map(row, function (el, j) {
          var padding = (overlayBoardArray && overlayBoardArray[i][j]) || ' ';
          return padding + (el || padding) + padding;
        });
        return seperate(row, '|').join('');
      });
      lines = seperate(lines, _.times(lines[0].length, _.constant('=')).join(''));
      return lines;
    }
  }
};

var Cursor = function () {
  var position = {x: 1, y: 1};
  var overlay = Board();

  return {
    getPosition: function () {
      return position;
    },
    moveCursor: function (move) {
      position.x = position.x + move.x;
      position.x = position.x < 0 ? 0 : position.x;
      position.x = position.x >= overlay.dimensions.x ? overlay.dimensions.x - 1 : position.x;
      position.y = position.y + move.y;
      position.y = position.y < 0 ? 0 : position.y;
      position.y = position.y >= overlay.dimensions.y ? overlay.dimensions.y - 1 : position.y;
    },
    overlayBoard: function () {
      overlay = Board();
      overlay.setToken('_', position.x, position.y);
      return overlay;
    }
  }
};

var Player = function (token) {
  return {
    human: true,
    name: 'Player ' + token,
    token: token,
    submitTurn: function (moveBoard, cursor) {
      var position = cursor.getPosition();
      moveBoard.setToken(token, position.x, position.y);
    }
  };
};


var CpuPlayer = function (token) {
  function think(callback) {
    setTimeout(function() {
      callback();
    }, 700);
  }
  return {
    human: false,
    name: 'CPU ' + token,
    token: token,
    submitTurn: function (moveBoard, callback) {
      var moves = [];
      _.each(moveBoard.boardArray(), function(row, y) {
        _.each(row, function(cell, x) {
          if (!cell) {
            moves.push({x:x, y:y});
          }
        });
      });
      var move = _.sample(moves);

      think(function() {
        moveBoard.setToken(token, move.x, move.y);
        callback();
      });
    }
  };
};

var Game = function (events) {
  var moveBoard = Board();
  var winner = null;
  var players = [Player('0'), CpuPlayer('X')];
  var player = players[0];
  var cursor = Cursor();
  var gameOver = false;

  events.onMove(function (move) {
    cursor.moveCursor(move);
    events.redraw();
  });

  events.onEnter(function () {
    try {
      if (player.human) {
        player.submitTurn(moveBoard, cursor);
        events.endTurn();
      }
    } catch (e) {
      console.log(e);
    }
  });

  function checkGameOver() {
    if (moveBoard.checkDraw()) {
      gameOver = true;
    }
    _.each(players, function (player) {
      if (moveBoard.checkWinner(player.token)) {
        winner = player;
        gameOver = true;
      }
    });
    return gameOver;
  }

  events.onEndTurn(function() {
    if (!checkGameOver()) {
      players = players.reverse();
      player = players[0];
      events.beginTurn(player.token);
    }
    events.redraw();
  });

  events.onBeginTurn(function() {
    if (!player.human) {
      player.submitTurn(moveBoard, function() {
        events.endTurn();
      });
    }
  });

  return {
    view: function () {
      var lines = ['Tic Tac Toe'];
      if (gameOver) {
        lines = lines.concat(BoardView(moveBoard).view());
        lines.push('Game over');
        if (winner) {
          lines.push(winner.name + ' wins!');
        } else {
          lines.push('It\'s a draw!');
        }
        lines.push('press any key to exit.');
        events.onKeypress(function () {
          events.exit();
        });
      } else {
        if (player.human) {
          lines = lines.concat(BoardView(moveBoard, cursor.overlayBoard()).view());
          lines.push(player.name + ', it is your turn');

        } else {
          lines = lines.concat(BoardView(moveBoard).view());
          lines.push('Hmm...');
        }
      }
      return lines;
    },
    update: function () {

    }
  };
};

var Graphics = function (rl, events) {
  events.onKeypress(function () {
    readline.moveCursor(process.stdout, -1, 0);
    readline.clearLine(process.stdout);
  });

  return {
    draw: function (view) {
      readline.cursorTo(process.stdout, 0, 0);
      readline.clearScreenDown(process.stdout);
      _.each(view, function (line) {
        console.log(line);
      });
    }
  }
};

var Events = function (rl) {
  var events = new EventEmitter();
  process.stdin.on('keypress', function (s, key) {
    var keyName = (key || {}).name;
    events.emit('input:keypress', keyName);

    if (_.contains(['up', 'down', 'left', 'right'], keyName)) {
      var move = {x: 0, y: 0};
      if (key.name === 'left') move.x = -1;
      else if (key.name === 'right') move.x = 1;
      else if (key.name === 'up') move.y = -1;
      else if (key.name === 'down') move.y = 1;
      events.emit('input:move', move);
    }
  });
  return {
    onKeypress: function (callback) {
      events.on('input:keypress', callback);
    },
    onEnter: function (callback) {
      rl.on('line', function () {
        callback()
      });
    },
    onMove: function (callback) {
      events.on('input:move', callback);
    },
    exit: function () {
      events.emit('exit');
    },
    onExit: function (callback) {
      events.on('exit', callback);
    },
    redraw: function () {
      events.emit('game:redraw');
    },
    onRedraw: function (callback) {
      events.on('game:redraw', callback);
    },
    beginTurn: function() {
      events.emit('game:begin-turn');
    },
    onBeginTurn: function (callback) {
      events.on('game:begin-turn', callback)
    },
    endTurn: function() {
      events.emit('game:end-turn');
    },
    onEndTurn: function (callback) {
      events.on('game:end-turn', callback)
    }
  };
};

var manager = function () {
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  var events = Events(rl);
  var graphics = Graphics(rl, events);
  var state = Game(events);

  function exit() {
    done = true;
    rl.close();
  }

  function run() {
    state.update();
    graphics.draw(state.view());
  }

  events.onExit(exit);
  events.onRedraw(run);

  return {
    run: run,
    exit: exit
  }
};

manager().run();
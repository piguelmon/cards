var express = require('express')
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
//var ivonaNode = require('ivona-node');
var fs = require('fs');
//var db = require('./db/db.js');
var jsonFile = "cah-base.json";
var cards = require('./db/' + jsonFile);
var routes = require('./main/routes');
var port = process.env.PORT || 3000;
var white_cards_used = [];
app.use(express.static(__dirname + '/main'));
app.use(express.static(__dirname + '/play'));
app.use(express.static(__dirname + '/game'));
routes(app);

server.listen(port, function() {
    console.log('Server listening on port %d', port);
});

var gameCode = '';
/*
var lineReader = require('readline').createInterface({
    input: fs.createReadStream(__dirname + '/cred/ivona_cred.txt')
});*/
var accessKey = '';
var secretKey = '';
var lineNo = 0;
var ivona = null;
/*
lineReader.on('line', function (line) {
    if (lineNo == 0) {
        accessKey = line.split('=')[1];
    } else if (lineNo == 1) {
        secretKey = line.split('=')[1];
        ivona = new ivonaNode({
            accessKey: accessKey,
            secretKey: secretKey
        });
    }
    ++lineNo;
});*/

io.on('connection', function (socket) {
    var addedUser = false;
    var addedGame = false;
    console.log('new connection');

    function generateGameCode() {
        var text = '';
        var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (var i=0; i<4; i++) {
            text += letters.charAt(Math.floor(Math.random() * letters.length));
        }
        return text;
    }

    // The host wants to create a new game lobby
    socket.on('new game', function () {
        if (gameCode) {
            socket.emit('host exists', {
                gameCode: gameCode
            });
            return;
        }
        addedGame = true;
        gameCode = generateGameCode();
        console.log('New game started with gameCode = ' + gameCode);
        white_cards_used[gameCode] = {};
        socket.emit('code created', {
            gameCode: gameCode
        });
    });


    // The client is logging into a room
    socket.on('login', function (data) {
        // Check the room code
        var roomCode = data.roomCode.toUpperCase();
        if (roomCode !== gameCode) {
            socket.emit('login error', {
                error: 'invalid room code ' + roomCode
            });
            return;
        }

        io.in(roomCode).clients(function(error, clients) {
            if (error) throw error;
            // Check that name is not already taken in this room
            for (var i = 0; i < clients.length; i++) {
                var client = io.sockets.connected[clients[i]];
                if (data.username === client.username) {
                    socket.emit('login error', {
                        error: 'name ' + data.username + ' already taken'
                    });
                    return;
                }
            }
            // Name is unique; add to gameroom
            socket.join(roomCode);
            socket.username = data.username;
            socket.roomCode = roomCode;
            addedUser = true;
            console.log(data.username + ' joined room ' + roomCode);
            socket.emit('login success');
            socket.broadcast.emit('user joined', {
                username: data.username
            });
        });

    });

    // The host has started the game
    socket.on('start game', function () {
        console.log('Game is starting!');
        /*
        db.blackCard(function (err, blackCard) {
            console.log("Chegou até aqui");
            console.log(blackCard);
            if (err) return console.log(err);
            //var audioFile = fs.createWriteStream(__dirname + '/game/audio/q.mp3');
            var ttv = blackCard.text.replace(/_/g, 'blank');
            var appVoice = { body: { voice: {
                name: 'Brian',
                language: 'en-GB',
                gender: 'Male'
            }}};
           // var stream = ivona.createVoice(ttv, appVoice).pipe(audioFile);
           /*
            stream.on('finish', function() {
                socket.emit('audio finished');
            });
        });*/
        var blackCard = null;
        var count = 0;
        for(var item in cards.blackCards){
           count++; 
        }
        var index = Math.floor(Math.random() * (count +1)); 
        blackCard = cards.blackCards[index];
        if(!blackCard){
            blackCard = cards.blackCards[0];
        }
        socket.emit('black card', {
            text: blackCard.text,
            pick: blackCard.pick
        });
        socket.broadcast.emit('new round', {
            pick: blackCard.pick,
            text: blackCard.text
        });
        
    });

    socket.on('gameOver', function(players,) {
        socket.broadcast.emit('gameOver', {
            scores: players,
        });
    })

    // The client has requested some cards
    socket.on('card request', function (data) {
        console.log('user requests ' + data.numCards + ' cards');
        /*
        db.whiteCards(data.numCards, function(err, whiteCards) {
            if (err) return console.log(err);
            socket.emit('white cards', {
                whiteCards: whiteCards
            });
        });*/
        var whiteCards = [];
        /*
        for(var i = 0; i < data.numCards; i++){
            if(!white_cards_used[socket.roomCode][cards.whiteCards[i]]){
                white_cards_used[socket.roomCode][cards.whiteCards[i]] = 1;
                whiteCards.push(cards.whiteCards[i]);
            }
        }*/
        var count = 0;
        for(var item in cards.whiteCards){
            if(!socket.roomCode){
                return null;
            }
            if(!white_cards_used[socket.roomCode][item]){
                white_cards_used[socket.roomCode][item] = 1;
                whiteCards.push(cards.whiteCards[item]);
                count++
            }
            if(count == data.numCards){
                break;
            }
            
        }
        socket.emit('white cards', {
            whiteCards: whiteCards
        });
    });


    socket.on('roundTimeLeft',function(timeLeft){
        socket.broadcast.emit('roundTimeLeftClient',timeLeft);
    })

    socket.on('updateState',function(data){
        socket.broadcast.emit('updateStateGame',data)
    })

    // The client has submitted an answer card
    socket.on('answer card', function (data) {
        console.log('received answer from ' + socket.username);
        socket.broadcast.emit('user answered', {
            username: socket.username,
            cardText: data.cardText,
            done: data.done
        });
    });

    // The game round is over
    socket.on('round over', function (data) {
        console.log('round over, all users submitted');
        socket.broadcast.emit('round over', {
            submissions: data.submissions
        });
    });

    // The client has submitted their vote
    socket.on('vote card', function (data) {
        console.log('received vote from ' + socket.username);
        socket.broadcast.emit('user voted', {
            username: socket.username,
            cardText: data.cardText,
            done: data.done
        });
    });

    // The voting is over
    socket.on('voting over', function (res) {
        console.log('voting over, all users voted');
        socket.broadcast.emit('voting over', res);
    });

    // The client or game host has disconnected
    socket.on('disconnect', function () {
        if (addedUser) {
            console.log(socket.username + ' left room');
            socket.broadcast.emit('user left', {
                username: socket.username
            });
        }
        if (addedGame) {
            console.log('Game host with code = ' + gameCode + ' has disconnected');
            socket.broadcast.emit('host left', {
                gameCode: gameCode
            });
            gameCode = '';
            addedGame = false;
        }
    });
});


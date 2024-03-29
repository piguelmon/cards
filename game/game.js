$(function() {
    // Pages
    var $newPage = $('.new.page');
    var $lobbyPage = $('.lobby.page');
    var $questionPage = $('.question.page');
    var $votePage = $('.vote.page');
    var $resultPage = $('.result.page');
    var $scorePage = $('.score.page');
    var $currentPage = $newPage;

    // Other jQuery elements
    var $header = $('.header');
    var $newButton = $('.newButton .button');
    var $gameCode = $('.code');
    var $lobbyList = $('.lobbyList');
    var $readyLabel = $('.readyLabel .label');
    var $startButton = $('.startButton .button');
    var $questionRound = $('.question.page .title');
    var $questionLabel = $('.questionLabel .label');
    var $answeredList = $('.answeredList');
    var $roundTimer = $('.roundTimer');
    var $submittedList = $('.submittedList');
    var $voteTimer = $('.voteTimer');
    var $votedList = $('.votedList');
    var $resultBody = $('.resultBody');
    var $scoreBody = $('.scoreBody');
    var numberOfrounds = 10;
    // State variables
    var socket = io();
    var state = null;

    function transitionTo($nextPage) {
        if ($currentPage == $nextPage) return;
        $currentPage.fadeOut();
        $nextPage.delay(400).fadeIn();
        $currentPage = $nextPage;
    }

    function updateLobby() {
        $lobbyList.empty();
        for (var i = 0; i < state.players.length; i++) {
            $lobbyList.append('<li class="lobbyPlayer">' + state.players[i].username + '</li>');
        }
        if (state.players.length >= 2) {
            $readyLabel.text('Todos prontos?');
            $startButton.removeAttr('disabled');
        } else {
            $readyLabel.text('Preciso mais ' + (2 - state.players.length) + ' jogadores.');
            $startButton.attr('disabled', 'disabled');
        }
    }

    function startTimer($timer, duration, $triggerPage, triggerCallback) {
        if (typeof startTimer.currentId == 'undefined') {
            startTimer.currentId = 0;
        }
        if (startTimer.currentId > 0) {
            clearInterval(startTimer.currentId);
            startTimer.currentId = 0;
        }
        var timeLeft = duration;
        $timer.text(timeLeft);
        startTimer.currentId = setInterval(function() {
            if (--timeLeft < 0) {
                clearInterval(startTimer.currentId);
                startTimer.currentId = 0;
                if ($currentPage == $triggerPage) {
                    triggerCallback();
                }
                return;
            }
            socket.emit('roundTimeLeft',timeLeft);
            $timer.text(timeLeft);
        }, 1000);
    }

    function endRound() {
        console.log('round over; start voting');
        var submittedMap = state.startVoting();
        socket.emit('round over', {
            submissions: submittedMap
        });
        $submittedList.empty();
        $votedList.empty();
        for (var user in submittedMap) {
            $submittedList.append('<li class="whiteCard"><button class="cardButton">' + submittedMap[user] + '</button></li>');
        }
        transitionTo($votePage);
        startTimer($voteTimer, 25, $votePage, endVoting);
    }

    function addResultRow(i) {
        r = state.results[i];
        $resultBody.append('<tr id="result' + i + '" style="visibility:hidden;">' +
            '<td class="label">' + r.user + '</td>' +
            '<td><button class="cardButton">' + r.cards + '</button></td>' +
            '<td class="label">' + r.voters.length + '</td>' +
        '</tr>');
        timeout = (state.results.length - i) * 2000;
        setTimeout(function() {
            $('#result' + i).css('visibility', 'visible').hide().fadeIn();
        }, timeout);
    }

    function endVoting() {
        socket.emit('voting over',{
            results: state.results
        });
        $resultBody.empty();
        state.results.sort(function(a, b) {
            return b.voters.length - a.voters.length;
        });
        for (var i = 0; i < state.results.length; i++) {
            addResultRow(i);
        }
        transitionTo($resultPage);
        var timeout = (state.results.length * 2000) + 2000;
        setTimeout(function() {
            if ($currentPage == $resultPage) {
                endResults();
            }
        }, timeout);
       
    }

    function addScoreRow(i) {
        r = state.players[i];
        $scoreBody.append('<tr id="score' + i + '" style="visibility:hidden;">' +
            '<td class="label">' + r.username + '</td>' +
            '<td class="label">' + r.score + '</td>' +
        '</tr>');
        timeout = (state.players.length - i) * 1000;
        console.log('setting visibility timeout of ' + timeout);
        setTimeout(function() {
            console.log('setting visible');
            $('#score' + i).css('visibility', 'visible').hide().fadeIn();
        }, timeout);
    }

    function endResults() {
        socket.emit('updateState', state);
        $scoreBody.empty();
        state.players.sort(function(a, b) {
            return b.score - a.score;
        });
        for (var i = 0; i < state.players.length; i++) {
            addScoreRow(i);
        }
        transitionTo($scorePage);
        var timeout = (state.players.length * 2000) + 2000;
        setTimeout(function() {
            if(state.round === numberOfrounds){
                socket.emit('gameOver',{
                    players: state.players
                });
                var timeout = (state.players.length * 2000) + 6000;
                setTimeout(function() {
                    window.location.reload();
                },timeout)
            }else{
                if ($currentPage == $scorePage) {
                    socket.emit('start game');
                }
            }
            
        }, timeout);
    }

    $newButton.click(function() {
        socket.emit('new game');
    });

    $startButton.click(function() {
        socket.emit('start game');
    });

    socket.on('code created', function (data) {
        state = new State(data.gameCode);
        $gameCode.text(state.gameCode);
        $lobbyList.empty();
        $header.delay(400).fadeIn();
        transitionTo($lobbyPage);
    });

    socket.on('host exists', function (data) {
        alert('Host instance already exists: ' + data.gameCode);
    });

    socket.on('user joined', function (data) {
        socket.emit('updateState', state);
        state.addUser(data.username);
        console.log('user joined, numPlayers = ' + state.players.length);
        updateLobby();
    });

    socket.on('user left', function (data) {
        state.removeUser(data.username);
        socket.emit('updateState', state);
        console.log('user left, numPlayers = ' + state.players.length);
        updateLobby();
        if (state.players.length < 2) {
            state.restart();
            socket.emit('updateState', state);
            transitionTo($lobbyPage);
        }
    });

    socket.on('black card', function (data) {
        console.log('Q: ' + data.text);
        state.newRound();
        $questionRound.text('Ronda ' + state.round);
     
        $questionLabel.text(data.text);
        $answeredList.empty();
        transitionTo($questionPage);
        startTimer($roundTimer, 20 + 10*data.pick, $questionPage, endRound);
    });

    socket.on('audio finished', function () {
        // Add time parameter to prevent browser caching
        var url = '/game/audio/q.mp3?cb=' + new Date().getTime();
        var audio = new Audio(url);
        audio.play();
    });

    socket.on('user answered', function (data) {
        state.addUserAnswer(data.username, data.cardText, data.done);
        if (data.done) {
            console.log(data.username + ' is done');
            $answeredList.append('<li class="answeredPlayer">' +
                data.username + '</li>');
        }
        if (state.isRoundOver()) {
            endRound();
        }
    });

    socket.on('user voted', function (data) {
        state.addUserVote(data.username, data.cardText, data.done);
        if (data.done) {
            $votedList.append('<li class="answeredPlayer">' +
                data.username + '</li>');
        }
        if (state.isVotingOver()) {
            endVoting();
        }
    });
});

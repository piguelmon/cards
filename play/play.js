$(function() {
    // Pages
    var $loginPage = $('.login.page');
    var $waitPage = $('.wait.page');
    var $cardPage = $('.card.page');
    var $resultPage = $('.result.page');
    var $scorePage = $('.score.page');
    $resultPage.fadeOut();
    var $votePage = $('.vote.page');
    var $currentPage = $loginPage

    // Other jQuery elements
    var $roundTimer = $('.roundTimer');
    var $roomCodeInput = $('.roomCode .input');
    var $usernameInput = $('.username .input');
    var $playButton = $('.playButton .button');
    var $welcomeLabel = $('.welcomeLabel .label');
    var $waitingLabel = $('.waitingLabel .label');
    var $question = $('.waitingLabel2 .label');
    var $cardList = $('.cardList');
    var $voteList = $('.voteList');
    var $resultBody = $('.resultBody');
    var $scoreBody = $('.scoreBody');
    // State variables
    var socket = io();
    var username = '';
    var cardsToAnswer = 0;
    var state = null;
    var roomCodePlay = null;
    function transitionTo($nextPage) {
        $currentPage.fadeOut();
        $nextPage.delay(400).fadeIn();
        $currentPage = $nextPage;
    }

    function registerClicks(message) {
        $('.cardButton').click(function() {
            if ($(this).attr('class') != 'cardButton' ||
                cardsToAnswer <= 0) {
                return;
            }
            var done = (--cardsToAnswer == 0);
            console.log('card selected: ' + $(this).text() +
                ', cards to answer: ' + cardsToAnswer);
            $(this).attr('class', 'cardButtonSelected');
            socket.emit(message, {
                cardText: $(this).text(),
                done: done
            });
            if (done) {
                $welcomeLabel.text('Resposta enviada!');
                $waitingLabel.text('Esperando os outros jogadores...');
                transitionTo($waitPage);
            }
        });
    }

    $playButton.click(function() {
        var roomCode = $roomCodeInput.val().trim();
        roomCodePlay = roomCode;
        username = $usernameInput.val().trim();
        if (roomCode.length == 4 && username) {
            socket.emit('login', {
                roomCode: roomCode,
                username: username
            });
        }
    });

    socket.on('updateStateGame',function(data) {
        if(data.gameCode === roomCodePlay){
            state = data;
        }
    });


    socket.on('gameOver',function(players) {
       console.log(players);
       endResults(players)
    })

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
            transitionTo($loginPage);
        }, timeout);
    }

    function endResults(players) {
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
            if ($currentPage == $scorePage) {
                socket.emit('start game');
            }
        }, timeout);
    }

    socket.on('login success', function () {
        var roomCode = $roomCodeInput.val().trim();
        socket.emit('getState',{
            roomCode: roomCode
        });
        console.log(username + ' logged in');
        $welcomeLabel.text('Hey, ' + username + '!');
        $waitingLabel.text('Waiting new round to start...');
        transitionTo($waitPage);
    });

    socket.on('login error', function (data) {
        alert('Error joining: ' + data.error);
    });

    socket.on('new round', function (data) {
        $resultBody.empty();
        cardsToAnswer = data.pick;
        $question.text(data.text);
        $('.cardButtonSelected').parent().remove();
        var cardsToRequest = 10 - $('.cardList li').length;
        console.log('new question, picking up ' + cardsToRequest + ' cards' +
            '; need to answer: ' + cardsToAnswer);
        socket.emit('card request', {
            numCards: cardsToRequest
        });
        transitionTo($cardPage);
    });

    socket.on('white cards', function (data) {
        console.log('recieved ' + data.whiteCards.length + ' initial cards');
        for (var i = 0; i < data.whiteCards.length; i++) {
            $cardList.append('<li class="whiteCard"><button class="cardButton">' + data.whiteCards[i] + '</button></li>');
        }
        registerClicks('answer card');
    });

    socket.on('round over', function (data) {
        $voteList.empty();
       
        for (var user in data.submissions) {
            if (user == username) continue;
            $voteList.append('<li class="whiteCard"><button class="cardButton">' + data.submissions[user] + '</button></li>');
        }
        cardsToAnswer = 1;
        registerClicks('vote card');
        transitionTo($votePage);
    });

    function addResultRow(r,i) {
        $resultBody.append('<tr id="result' + i + '" style="visibility:hidden;">' +
            '<td class="label">' + r.user + '</td>' +
            '<td><button class="cardButton">' + r.cards + '</button></td>' +
            '<td class="label">' + r.voters.length + '</td>' +
        '</tr>');
        $('#result' + i).css('visibility', 'visible').hide().fadeIn();
    }

    function dynamicSort(property,len) {
        var sortOrder = 1;
        if(property[0] === "-") {
            sortOrder = -1;
            property = property.substr(1);
        }
        return function (a,b) {
            /* next line works with strings and numbers, 
             * and you may want to customize it to your needs
             */
            if(len){
                var result = (a[property].length < b[property].length) ? -1 : (a[property].length > b[property].length) ? 1 : 0;
            }else{
                var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
            }
            
            return result * sortOrder;
        }
    }

    socket.on('roundTimeLeftClient',function(timeLeft){
        $roundTimer.text(timeLeft);
    });

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
            if ($currentPage == $scorePage) {
                socket.emit('start game');
            }
        }, timeout);
    }

    socket.on('voting over', function (res) {
        res.results.sort(dynamicSort("-voters",true));
        for(var i = 0; i < res.results.length; i++) {
            addResultRow(res.results[i],i)
        }
        transitionTo($resultPage);
        /*
        var timeout = (state.results.length * 2000) + 2000;
        setTimeout(function() {
            if ($currentPage == $resultPage) {
                endResults();
            }
        }, timeout);*/
        //$question.text(" ");

        /*
        $welcomeLabel.text('A votação acabou!');
        $waitingLabel.text('Esperando nova ronda...');
        transitionTo($waitPage);*/
    });

    socket.on('host left', function (data) {
        $roomCodeInput.val('');
        cardsToAnswer = 0;
        transitionTo($loginPage);
        alert('Host left the room ' + data.gameCode);
    });
});

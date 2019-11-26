require("./config");

const express = require('express');
const app = express();
const cors = require('cors');

const axios = require('axios');
const pick = require('lodash.pick');


const port = process.env.CURRENT_NODE;
const nextNode = process.env.NEXT_NODE;

getOriginalChips = () => {
    return [
        "0:0", "0:1", "0:2", "0:3", "0:4", "0:5", "0:6",
        "1:1", "1:2", "1:3", "1:4", "1:5", "1:6",
        "2:2", "2:3", "2:4", "2:5", "2:6", 
        "3:3", "3:4", "3:5", "3:6", 
        "4:4", "4:5", "4:6", 
        "5:5", "5:6",
        "6:6" 
    ];
}

shuffle = (array) => {
    var currentIndex = array.length, temporaryValue, randomIndex;
    
    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
    
        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;
    
        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }
    
    return array;
}

chunkArray = (myArray, chunk_size) => {
    let results = [];
    
    while (myArray.length) {
        results.push(myArray.splice(0, chunk_size))
    }

    return results;
}


let nodeData = {
    users: [],
    localUser: null,
    games: [],
};

const getDataForOverride = () => {
    return pick(nodeData, ['users', 'games']);
}

const overrideSharedData = (sharedData) => {
    for (let key in sharedData) {
        nodeData[key] = sharedData[key];
    }
}

const sendSyncRequest = (data, initNode) => {
    return axios.put(`https://lurana-domino.herokuapp.com:${ nextNode }/sync-data`, {data, initNode});
}

const getUserData = () => {
    let name = nodeData.localUser;
    let games = nodeData.games.filter(game => {
        return game.player_1 === nodeData.localUser || game.player_2 === nodeData.localUser || game.status === "not_started";
    });

    return { name, games };
}

app.use(cors());
app.use(express.json());

app.post('/login', (req, res) => {
    let user = req.body.username;

    if (! nodeData.users.find(existentUsers => existentUsers === user)) {
        nodeData.users.push(user);
        nodeData.localUser = user;

    sendSyncRequest(getDataForOverride(), port);
    }
    res.json(getUserData());
});

app.put('/sync-data', (req, res) => {
    if (req.body.initNode !== port) {
        let {data, initNode} = req.body;
        
        overrideSharedData(data);

        console.log(nodeData);

        sendSyncRequest(data, initNode);
    }
    

    res.json({'sucess': true});    
});

app.get('/fresh-data', (req, res) => {
    res.json(getUserData());
});

app.post('/games', (req, res) => {
    let newGame = {
        id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
        name: req.body.name,
        player_1: nodeData.localUser,
        chips_player_1: [],
        player_2: null,
        chips_player_2: [],
        started_by: "player_1",
        joined_by: "player_2",
        starts: "player_1",
        moves: [],
        status: "not_started",
        turn: "player_1",
        winner: null,
    }

    nodeData.games.push(newGame);

    sendSyncRequest(getDataForOverride(), port);

    res.json({"success": true});
});

app.put('/games/:game/join', (req, res) => {
    let game = nodeData.games.find(game => game.id === req.params.game);
    game[game.joined_by] = nodeData.localUser;
    game.status = "started";

    chunkedShuffledShips = chunkArray(shuffle(getOriginalChips()), 12);
    
    game.chips_player_1 = chunkedShuffledShips[0];
    game.chips_player_2 = chunkedShuffledShips[1];

    sendSyncRequest(getDataForOverride(), port);

    res.json({"success": true});
});

app.post('/games/:game/moves', (req, res) => {
    let game = nodeData.games.find(game => game.id === req.params.game);

    let playedChip = req.body.chip;
    let newMove = {
        player: game[game.turn],
        chip: playedChip
    }

    game.moves.push(newMove);

    let playerChips;
    if (game.turn === "player_1") {
        playerChips = game["chips_player_1"];
        game.turn = "player_2";
    } else {
        playerChips = game["chips_player_2"];
        game.turn = "player_1";
    }

    playerChips.splice(playerChips.indexOf(playedChip), 1);

    sendSyncRequest(getDataForOverride(), port);

    res.json({"success": true});
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
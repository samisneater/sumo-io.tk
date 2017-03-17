const express = require('express');
const app = express();
const serv = require('http').Server(app);
const port = 8081;

const blank = {};

const playerConst = {
	terminalVelocity: 4,
	resistance: 0.8,
	width: 25,
	height: 25,
	borders: [0, 500, 0, 500],
	accel: 2.3,
	collision: -0.7,
	collisionMult: 3
}

app.get('/', function(req, res) {
	res.send('LEL WHY YOU DIRECT CONNECT TO ME BRUH!')
});
app.use('/client', express.static(__dirname + '/client'));

serv.listen(port);
console.log("Server started.");

var SOCKET_LIST = {};
var PLAYER_LIST = {};
var oldGameData = {};
var ToKill = {};

var Player = function(id, name, color) {
	var self = {
		x: 250,
		y: 250,
		xVel: 0,
		yVel: 0,
		direction: null,
		id: id,
		width: playerConst.width,
		height: playerConst.height,
		name: name,
		pressingRight: false,
		pressingLeft: false,
		pressingUp: false,
		pressingDown: false,
		color: color,
		maxSpd: 10,
		lastHit: null,
		points: 0
	}
	self.updatePosition = function() {
		if (self.pressingRight) {
			self.xVel += playerConst.accel;
			self.direction = "right";
		}
		if (self.pressingLeft) {
			self.xVel -= playerConst.accel;
			self.direction = "left";
		}
		if (self.pressingUp) {
			self.yVel -= playerConst.accel;
			self.direction = "up";
		}
		if (self.pressingDown) {
			self.yVel += playerConst.accel;
			self.direction = "down";
		}

		self.xVel *= playerConst.resistance;
		self.yVel *= playerConst.resistance;

		self.x += self.xVel;
		self.y += self.yVel;

		if (self.xVel < 0.1 && self.xVel > -0.1) {
			self.xVel = 0;
		}

		if (self.yVel < 0.1 && self.yVel > -0.1) {
			self.yVel = 0;
		}

		for (i in PLAYER_LIST) {
			if (JSON.stringify(self) != JSON.stringify(PLAYER_LIST[i])) {
				if (colCheck(self, PLAYER_LIST[i], true) != null) {
					PLAYER_LIST[i].xVel = self.xVel * playerConst.collisionMult;
					PLAYER_LIST[i].yVel = self.yVel * playerConst.collisionMult;
					self.yVel *= playerConst.collision;
					self.xVel *= playerConst.collision;
					PLAYER_LIST[i].lastHit = self.id;
				}
			}
		}

		self.x = Math.min(Math.max(parseInt(self.x), playerConst.borders[0]), playerConst.borders[1] - playerConst.width);
		self.y = Math.min(Math.max(parseInt(self.y), playerConst.borders[2]), playerConst.borders[3] - playerConst.height);


		if (self.x === playerConst.borders[0] || self.x === playerConst.borders[1] - playerConst.width || self.y === playerConst.borders[2] || self.y === playerConst.borders[3] - playerConst.height) {
			try {
				if (self.color != PLAYER_LIST[self.lastHit].color) {
					ToKill[self.id] = "Killed";
				}
			}
			catch (err) {
				ToKill[self.id] = "Killed";
			};
		}
	}
	return self;
}

var io = require('socket.io')(serv, {});
io.sockets.on('connection', function(socket) {
	socket.id = Math.random();
	SOCKET_LIST[socket.id] = socket;

	var handshakeData = socket.request;

	var player = Player(socket.id, handshakeData._query['name'].substring(0, 20), handshakeData._query['color']);
	PLAYER_LIST[socket.id] = player;

	socket.emit('newPositions', packData());
	socket.emit('socketID', socket.id.toString());
	socket.on('disconnect', function() {
		delete SOCKET_LIST[socket.id];
		delete PLAYER_LIST[socket.id];

		for (var i in SOCKET_LIST) {
			var tempSocket = SOCKET_LIST[i];
			tempSocket.emit('overWritePositions', packData());
		}

	});



	socket.on('keyPress', function(data) {
		if (data.inputId === 'left')
			player.pressingLeft = data.state;
		else if (data.inputId === 'right')
			player.pressingRight = data.state;
		else if (data.inputId === 'up')
			player.pressingUp = data.state;
		else if (data.inputId === 'down')
			player.pressingDown = data.state;
	});


});

function packData() {

	var pack = {};
	for (var i in PLAYER_LIST) {
		var player = PLAYER_LIST[i];
		player.updatePosition();
		pack[i] = {
			x: player.x,
			y: player.y,
			direction: player.direction,
			name: player.name,
			points: player.points,
			color: player.color
		};
	}

	return pack;

}

setInterval(function() {
	for (var i in SOCKET_LIST) {
		var tempSocket = SOCKET_LIST[i];
		tempSocket.emit('overWritePositions', packData());
	}
}, 5000);

setInterval(function() {

	var pack = packData();

	var tempPack = {};
	for (i in pack) {
		if (JSON.stringify(pack[i]) != JSON.stringify(oldGameData[i])) {
			tempPack[i] = pack[i];
		}
	}

	if (JSON.stringify(tempPack) != JSON.stringify(blank)) {
		oldGameData = pack;
		for (var i in SOCKET_LIST) {
			var socket = SOCKET_LIST[i];
			socket.emit('newPositions', tempPack);
		}
	}


	for (i in ToKill) {

		if (PLAYER_LIST[i].lastHit != null && PLAYER_LIST[PLAYER_LIST[i].lastHit] != undefined) {
			//PLAYER_LIST[PLAYER_LIST[i].lastHit].points += Math.ceil(PLAYER_LIST[i].points / 2);
			PLAYER_LIST[PLAYER_LIST[i].lastHit].points += 1;
			SOCKET_LIST[i].emit("youDied", PLAYER_LIST[PLAYER_LIST[i].lastHit].name);
		}
		else {
			SOCKET_LIST[i].emit("youDied", 1);
		}

		SOCKET_LIST[i].disconnect();

		delete ToKill[i];



	}



}, 1000 / 25);

function colCheck(shapeA, shapeB, move) {
	// get the vectors to check against
	var vX = (shapeA.x + (shapeA.width / 2)) - (shapeB.x + (shapeB.width / 2)),
		vY = (shapeA.y + (shapeA.height / 2)) - (shapeB.y + (shapeB.height / 2)),
		// add the half widths and half heights of the objects
		hWidths = (shapeA.width / 2) + (shapeB.width / 2),
		hHeights = (shapeA.height / 2) + (shapeB.height / 2),
		colDir = null;

	// if the x and y vector are less than the half width or half height, they we must be inside the object, causing a collision
	if (Math.abs(vX) < hWidths && Math.abs(vY) < hHeights) {
		// figures out on which side we are colliding (top, bottom, left, or right)
		var oX = hWidths - Math.abs(vX),
			oY = hHeights - Math.abs(vY);
		if (oX >= oY) {
			if (vY > 0) {
				colDir = "t";
				if (move) {
					shapeA.y += oY;
				}
			}
			else {
				colDir = "b";
				if (move) {
					shapeA.y -= oY;
				}
			}
		}
		else {
			if (vX > 0) {
				colDir = "l";
				if (move) {
					shapeA.x += oX;
				}
			}
			else {
				colDir = "r";
				if (move) {
					shapeA.x -= oX;
				}
			}
		}
	}
	return colDir;
}

const http = require('http');
const socketio = require('socket.io');

const fs = require('fs');

const port = process.env.PORT || process.env.NODE_PORT || 3000;

const handler = (req, res) => {
  fs.readFile(`${__dirname}/../client/index.html`, (err, data) => {
    if (err) {
      throw err;
    }

    res.writeHead(200);
    res.end(data);
  });
};

const app = http.createServer(handler);

const io = socketio(app);

const movRad = 10;
var roomName;
const roomMax = 3;
var roomCount = 3;
var roomNum = 1;
var users = {};

var enemySetup = {};
var enemyTracker = {};
const spawnRange = 20;

// helper functions
// spawn enemies
const spawnEnemies = (enemies) => {
  var eachEnemy = {};
  
  //fill eachEnemy with x and y spawn points off screen
  for (let i = 0; i < enemies.numToSpawn; i++) {
    var limitXorY = Math.floor(Math.random() *2); //determine which axis to spawn on
    var xSpawn;
    var ySpawn;
    
    //if 0, spawn on y axis either to the left or right of screen
    if(limitXorY)
    {
      xSpawn = Math.floor(Math.random() * spawnRange) + 1;
      if (xSpawn <= spawnRange / 2)
      {
        xSpawn -= 10;
      }
      else
      {
        xSpawn += enemies.spawnWidth;
      }
      ySpawn = Math.floor(Math.random() * enemies.spawnHeight);
    }
    
    //else, spawn on x axis either above or below screen
    else
    {
      ySpawn = Math.floor(Math.random() * spawnRange) + 1;
      if (ySpawn <= spawnRange / 2)
      {
        ySpawn -= 10;
      }
      else
      {
        ySpawn += enemies.spawnHeight;
      }
      xSpawn = Math.floor(Math.random() * enemies.spawnWidth);
    }
    
    //create enemy
    const time = new Date().getTime();
    eachEnemy[i] = {
      lastUpdate: time,
      x: xSpawn,
      y: ySpawn,
      rad: 25,
      fill: '#F00',
      speed: 5,
      velX: 0,
      velY: 0,
      alive: true,
    };
  }
  return eachEnemy;
};

const onJoined = (sock) => {
  const socket = sock;

  socket.on('join', (data) => {
    socket.name = data.name;
    // if active room is full, create new room
    if (roomCount >= roomMax)
    {
      roomName = `room${roomNum}`; // set active room to new room
      socket.room = roomName;
      roomCount = 0;
      roomNum++;
      
      //first enemy wave parameters
      enemySetup[socket.room] =
      {
        numToSpawn: 3,
        numAlive: 3,
        spawnWidth: data.spawnWidth,
        spawnHeight: data.spawnHeight,
      };
      
      //set up enemies and add to the enemy tracker for this room
      enemyTracker[socket.room] = spawnEnemies(enemySetup[socket.room]);
      socket.emit('spawnEnemies', enemyTracker[socket.room]);
    }

    // else join active room, increment roomCount, and send room enemies to new player
    else {
      socket.room = roomName;
      roomCount++;
      socket.emit('spawnEnemies', enemyTracker[socket.room]);
    }
    
    //add player to user tracker by room with x and y position
    users[socket.room] = {};
    users[socket.room][socket.name] = {};
    users[socket.room][socket.name].x = data.playerX;
    users[socket.room][socket.name].y = data.playerY;
    socket.emit('learnRoom', roomName); //sent client their room name
    socket.join(socket.room);
  });
  
  socket.on('disconnect', () => {
    socket.leave(socket.room);
    delete users[socket.room][socket.name];
  });
};

//process key presses when requested
const onMove = (sock) => {
  const socket = sock;
  socket.on('movement', (data) => {
    const time = new Date().getTime();
    data.coords.lastUpdate = time;

    if (data.keysDown[87] && data.keysDown[68] || data.keysDown[80] && data.keysDown[222]) {
      data.coords.x += Math.cos(45 * Math.PI / 180) * movRad;
      data.coords.y -= Math.sin(45 * Math.PI / 180) * movRad;
    }

    else if (data.keysDown[87] && data.keysDown[65] || data.keysDown[80] && data.keysDown[76]) {
      data.coords.x -= Math.cos(45 * Math.PI / 180) * movRad;
      data.coords.y -= Math.sin(45 * Math.PI / 180) * movRad;
    }

    else if (data.keysDown[65] && data.keysDown[83] || data.keysDown[76] && data.keysDown[186]) {
      data.coords.x -= Math.cos(45 * Math.PI / 180) * movRad;
      data.coords.y += Math.sin(45 * Math.PI / 180) * movRad;
    }

    else if (data.keysDown[68] && data.keysDown[83] || data.keysDown[186] && data.keysDown[222]) {
      data.coords.x += Math.cos(45 * Math.PI / 180) * movRad;
      data.coords.y += Math.sin(45 * Math.PI / 180) * movRad;
    }

    else if (data.keysDown[65] || data.keysDown[76]) {
      data.coords.x -= movRad;
    }

    else if (data.keysDown[68] || data.keysDown[222]) {
      data.coords.x += movRad;
    }

    else if (data.keysDown[87] || data.keysDown[80]) {
      data.coords.y -= movRad;
    }

    else if (data.keysDown[83] || data.keysDown[186]) {
      data.coords.y += movRad;
    }

    // contain players on canvas
    if (data.coords.x < 0)
      data.coords.x = 0;
    if (data.coords.y < 0)
      data.coords.y = 0;
    if(data.coords.x > data.winWidth)
      data.coords.x = data.winWidth;
    if(data.coords.y > data.winHeight)
      data.coords.y = data.winHeight;
    
    if(data.room)
    {
      users[data.room][data.name].x = data.coords.x;
      users[data.room][data.name].y= data.coords.y;
    }
    
    io.sockets.in(socket.room).emit('move', data);
  });
};

//emit to everybody a player's attack status
const onAttack = (sock) => {
  const socket = sock;
  
  socket.on('updateAttack', (data) => {
    const time = new Date().getTime();
    data.coords.lastUpdate = time;
    
    io.sockets.in(socket.room).emit('attack', data);
  });
};

//check for collisions when player attacks
const onCollisionCheck = (sock) => {
  const socket = sock;
  
  socket.on('collisionCheck', (data) => {
    var enemies = enemyTracker[socket.room];
    let keys = Object.keys(enemies);
    
    //check player's weapon tip to see if it is in the enemies radius
    for(var i=0; i <keys.length; i++){
			const enemy = enemies[keys[i]];
			if(enemy.alive){
        var dx = enemy.x - data.weaponX;
        var dy = enemy.y - data.weaponY;
        var mag = Math.sqrt(dx * dx + dy * dy);
        
        if(mag <= enemy.rad)
        {
          delete enemyTracker[socket.room][i];
        }
			}
		}
    io.sockets.in(socket.room).emit('enemiesUpdated', enemyTracker[socket.room]);
  });
};

//update enemy positions when requested
const onUpdateEnemies = (sock) => {
  const socket = sock;
  
  socket.on('updateEnemies', (player) => {
    var enemies = enemyTracker[player.room];
    let keys = Object.keys(enemies);
    
    //determine player to follow for each enemy
    for(var i=0; i <keys.length; i++){
			const enemy = enemies[keys[i]];
			if(enemy.alive){
        var deltaX = users[player.room][player.name].x - enemy.x;
        var deltaY = users[player.room][player.name].y - enemy.y;
        var leastMag = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        //find closest player
        for(var user in users[socket.room])
        {
          if(user.x !== null)
          {
            var dx=(user.x-enemy.x);
            var dy=(user.y-enemy.y);
            var mag=Math.sqrt(dx*dx+dy*dy);
          
            if(mag < leastMag)
            {
              deltaX = dx;
              deltaY = dy;
              leastMag = mag;
            }
          }
        }
				
        //set enemy velocity
				enemy.velX = (deltaX/leastMag)*enemy.speed;
				enemy.velY = (deltaY/leastMag)*enemy.speed;
        
        enemy.x += enemy.velX;
        enemy.y += enemy.velY;
			}
      enemyTracker[player.room][i] = enemy;
		}
    io.sockets.in(player.room).emit('enemiesUpdated', enemyTracker[player.room]);
    //socket.emit('enemiesUpdated', enemyTracker[player.room]);
  });
};

io.on('connection', (socket) => {
  onJoined(socket);
  onMove(socket);
  onAttack(socket);
  onCollisionCheck(socket);
  onUpdateEnemies(socket);
});

app.listen(port, (err) => {
  if (err) {
    throw err;
  }
  console.log(`Listening on 127.0.0.1: ${port}`);
});


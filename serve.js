
var fs = require('fs'),
  http = require('http'),
  WebSocket = require('ws'),
  url = require('url'),
  path = require('path'),
  fun = require('./common/fun')



var STREAM_SECRET = 'supersecret';
var RECORD_STREAM = true;
var socketServer = new WebSocket.Server({ port: 8082, perMessageDeflate: false });
socketServer.connectionCount = 0;

socketServer.on('connection', function (socket, upgradeReq) {

  socketServer.connectionCount++;
  var wsId = new URL(upgradeReq.url, 'http://localhost:8080').searchParams.get('id')
  socket.myId = wsId
  console.log(
    'New WebSocket Connection: ',
    wsId,
    (upgradeReq || socket.upgradeReq).socket.remoteAddress,
    (upgradeReq || socket.upgradeReq).headers['user-agent'],
    '(' + socketServer.connectionCount + ' total)'
  );
  socket.on('close', function (code, message) {
    socketServer.connectionCount--;
    console.log(
      'Disconnected WebSocket (' + wsId + ' ' + socketServer.connectionCount + ' total)'
    );
  });
});
socketServer.broadcast = function (data) {
  socketServer.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      if (client.myId === data.id) {
        client.send(data.data);
      }
      
    }
  });
};


var streamServer = http.createServer(function (request, response) {
  var id = new URL(request.url, 'http://localhost:10002').searchParams.get('id')
  var params = new URL(request.url, 'http://localhost:10002').pathname

  if (params.replace('/', '') !== STREAM_SECRET) {
    console.log(
      'Failed Stream Connection: ' + request.socket.remoteAddress + ':' +
      request.socket.remotePort + ' - wrong secret.'
    );
    response.end();
  }

  response.connection.setTimeout(0);
  console.log(
    'Stream Connected: ' +
    id +
    request.socket.remoteAddress + ':' +
    request.socket.remotePort
  );
  request.on('data', function (data) {


    socketServer.broadcast({ data: data, id: id });


    if (request.socket.recording) {
      request.socket.recording.write(data);
    }

  });
  request.on('end', function () {
    console.log('close');
    if (request.socket.recording) {
      request.socket.recording.close();
    }
  });


  if (RECORD_STREAM && id) {
    let dir = `recordings/${id}`
    try {
      fs.statSync(dir)
    } catch (error) {
      fs.mkdirSync(dir)
    }
    dir = `recordings/${id}/${fun.dateFtt("yyyy-MM-dd",new Date())}`
    try {
      fs.statSync(dir)
    } catch (err) {
      fs.mkdirSync(dir)
    }
    var paths = `${dir}/${Date.now()}.ts`
    request.socket.recording = fs.createWriteStream(paths);
  }
  
}).listen(8081);

(function () {
  const ffmpeg = require('fluent-ffmpeg')
  const camList = [
    {
      type: 'dahua',
      id: 148,
      running: false,
      account: 'admin',
      pwd: '1234qwer',
      port: 80,
      url: ''
    },
    {
      type: 'dahua',
      id: 147,
      running: false,
      account: 'admin',
      pwd: '1234qwer',
      port: 80,
      url: ''
    }
  ]
  const ourUrl = 'http://127.0.0.1:8081/'
  const secret = 'supersecret'
  const camObj = []
  camList.forEach((item, index) => {
    camList[index].url = `rtsp://${item.account}:${item.pwd}@192.168.0.${item.id}:${item.port}/cam/realmonitor?channel=1&subtype=0`
    camObj[index] = ffmpeg(camList[index].url)
      .outputOptions([
        '-q', '0', '-f', 'mpegts', '-codec:v', 'mpeg1video', '-s', '800*600'
      ])
      .save(`${ourUrl}${secret}?id=${item.id}`)
      .on('start', function (e) {
        camObj[index].running = true
        console.log('stream is start: ' + e)
      })
      .on('end', function () {
        camObj[index].running = false
        console.log('ffmpeg is end')
      })
      .on('error', function (err) {
        camObj[index].running = false
        console.log('ffmpeg is error! ' + err)
        reloadStream(index, camList[index].url)
      })
  })
  const reloadStream = (index, uri) => {
    if (!uri) return
    if (camObj[index].running) {
      camObj[index].kill()
      camObj[index].run()
    } else {
      camObj[index].run()
    }
  }



}).call(this)




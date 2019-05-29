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

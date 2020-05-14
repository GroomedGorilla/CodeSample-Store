const kue = require('kue'),
  audioFn = require('../audio'),
  dbFn = require('../../config/db/_helpers');

let queue = kue.createQueue({
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: 6379
  }
});

queue.process('watermark', 5, async (job, done) => {
  console.log('Entered worker');
  handleProcessWatermark(job, done);
});

var handleProcessWatermark = (job, done) => {
  audioFn.processWatermark(job.data.userId, job.data.soundId, job.data.extension, dbFn.addPrevLocAndMetaData, job.data.makeAvailable) //addPreviewLocation)
    .then((success) => {
      console.log('handleProcessWatermark finishing');
      done();
    })
    .catch((error) => {
      if (400 <= error.status <= 499) {
        job.attempts(0, () => {
          return done(new Error(JSON.stringify(error)));
          // Passing the done() method this way registers a failed attempt.
          // Limitation of Error module is that it only accepts strings
          // even though I want to send an object (err) which I might want
          // to process.
        });
      }
      return done(new Error(JSON.stringify(err)));
    });
}
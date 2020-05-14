const kue = require('kue');

let queue = kue.createQueue({
    prefix: 'q', // Can change this value incase you're using multiple apps using same
    // redis instance.
    redis: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: 6379 // default
    }
});

var queueWatermarkJob = (userId, soundId, extension, makeAvailable) => {
    console.log(`Queuing watermark for sound ${soundId}`);
    const wmJob = queue.create('watermark', { // Job Type
            title: `userId : soundId`,
            userId: userId,
            soundId: soundId,
            extension: extension,
            makeAvailable: makeAvailable,
        })
        .removeOnComplete(true) // REMOVE THE JOB FROM THE QUEUE ONCE IT'S COMPLETED
        .attempts(5) // The maximum number of retries you want the job to have
        .backoff({
            delay: 60 * 1000,
            type: 'exponential'
        }) // Time between retries. Read docs.
        .save(); //Persist

    wmJob.on('failed', function (errorMessage) {
        console.log('Job failed');
        let error = JSON.parse(errorMessage);
        // error now contains the object passed from the worker when the job failed
        console.log(error); // Check it out for yourself
        // call pagerduty in case of failure
    });

    wmJob.on('complete', function (result) {
        console.log('Job completed with data ', result);
    });
    wmJob.on('enqueue', function (result) {
        console.log('Job enqueued ', result);
    });
    wmJob.on('start', function (result) {
        console.log('Job started ', result);
    });
}

module.exports = {
    queueWatermarkJob
}
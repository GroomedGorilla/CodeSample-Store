const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const axios = require("axios");
const mm = require("music-metadata");

var fileDir = "./audio/processing";

//TODO remove default user and uuid
var processWatermark = (
  userID = "123456",
  uuid = "2f44ccc7-e82b-4f02-999f-df355e01fabe",
  extension = "wav",
  onComplete,
  makeAvailable
) => {
  // async (userID = '123456', uuid = '2f44ccc7-e82b-4f02-999f-df355e01fabe', onComplete) => {
  // Download file from S3
  // -> onComplete Apply Watermark
  // --> onComplete Upload to Preview bucket
  // ==> onComplete delete server-side file by uuid

  console.log(`Hostname found: ${process.env.HOSTNAME}`);

  return new Promise((resolve, reject) => {
    axios
      .post(`${process.env.HOSTNAME}/s3/preview/downloadFile`, {
        fileKey: uuid,
        extension: extension,
      })
      .then((response) => {
        //TODO check if response is valid (not 500)
        console.log("Got a response", response);

        var filename = `${uuid}.${extension}`;
        mm.parseFile(`${fileDir}/${filename}`)
          .then((metadata) => {
            console.log(metadata);

            watermarkAudio(
              true,
              userID,
              uuid,
              extension,
              metadata,
              onComplete,
              makeAvailable
            );
            resolve({
              success: true,
              error: null,
            });
          })
          .catch((err) => {
            console.error(err.message);
          });
      })
      .catch((error) => {
        console.log(`Axios error on downloadFile -`);
        console.log(error);
        reject({
          success: false,
          error: error,
        });
      });
  });
};

var watermarkAudio = (
  deleteFile = false,
  userID,
  uuid,
  extension,
  metadata,
  onComplete,
  makeAvailable
) => {
  var watermarkCommand = new ffmpeg();
  var mergeCommand = new ffmpeg();
  var repeatWatermarkCommand = new ffmpeg();

  var originalFile = `${fileDir}/${uuid}.${extension}`;
  var watermarkGap = `${fileDir}/${userID}-${uuid}-gap.mp3`;
  var watermark = "./audio/watermark/beep.mp3"; //TODO Insert actual watermark. Original removed for proprietary reasons
  var watermarkedFile = `${fileDir}/${userID}-${uuid}-rpt.mp3`;
  var finalFileName = `${userID}-${uuid}-preview.mp3`;
  var finalFile = `${fileDir}/${finalFileName}`;

  // ffmpeg -i <blank audio> -i < audio file 2> -filter_complex "aevalsrc=0:d= <time> [s1];[s1][1:a]concat=n=2:v=0:a=1[aout]" -c:v copy -map 0:v -map [aout] <output file>
  var preWatermarkGap = 2;
  var loopNumber = Math.floor(metadata.format.duration / (preWatermarkGap + 1));
  loopNumber = loopNumber > 0 ? loopNumber : 1;

  watermarkCommand
    .input(watermark)
    .complexFilter([
      `aevalsrc=0:d=${preWatermarkGap} [s1]`,
      "[s1][0:a]concat=n=2:v=0:a=1[aout]",
    ])
    .videoCodec("copy")
    .outputOptions(["-map 0:v?", "-map [aout]"])
    .on("error", (err) => {
      console.log("An error occurred: " + err.message);
      return {
        success: false,
        error: err.message,
      };
    })
    .on("end", () => {
      console.log("Blank Watermark Created");

      repeatWatermarkCommand
        .input(`amovie=${watermarkGap}:loop=${loopNumber}`)
        .inputFormat("lavfi")
        .on("error", function (err) {
          console.log("An error occurred: " + err.message);
          return {
            success: false,
            error: err.message,
          };
        })
        .on("end", function () {
          console.log("Repeating finished !");

          // ffmpeg -i <output from silent and short clip> -i <original long clip> -filter_complex "amix=inputs=2:duration=longest:dropout_transition=0, volume=2" <output audio file
          mergeCommand
            .input(watermarkedFile)
            .input(originalFile)
            .complexFilter([
              "amix=inputs=2:duration=longest:dropout_transition=0, volume=2",
            ])
            .on("error", (err) => {
              console.log("An error occurred: " + err.message);
              return {
                success: false,
                error: err.message,
              };
            })
            .on("end", () => {
              console.log("Watermarked Audio Ready");

              // Delete unnecessary files
              if (deleteFile) {
                fs.unlink(watermarkGap, (err) => {
                  if (err) throw err;
                  console.log(`${watermarkGap} was deleted`);
                });
                fs.unlink(watermarkedFile, (err) => {
                  if (err) throw err;
                  console.log(`${watermarkedFile} was deleted`);
                });
                fs.unlink(originalFile, (err) => {
                  if (err) throw err;
                  console.log(`${originalFile} was deleted`);
                });
              }

              axios
                .post(`${process.env.HOSTNAME}/s3/preview/uploadFile`, {
                  fileName: finalFileName,
                })
                .then((response) => {
                  // console.log(response);
                  // console.log(response.status);
                  debugger;
                  onComplete(
                    uuid,
                    response.data.previewId,
                    metadata,
                    makeAvailable
                  );
                  return {
                    success: true,
                    error: null,
                  };
                })
                .catch((error) => {
                  console.log(error);
                  return {
                    success: false,
                    error: error,
                  };
                });
            })
            .save(finalFile);
        })
        .save(watermarkedFile);
    })
    .save(watermarkGap);
};

module.exports = {
  watermarkAudio,
  processWatermark,
};

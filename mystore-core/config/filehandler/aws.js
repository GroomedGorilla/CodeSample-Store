var CryptoJS = require("crypto-js"),
  clientSecretKey = "client secret key", //process.env.CLIENT_SECRET_KEY,
  bucketRegion = "eu-west-2",
  previewBucket = "groomedgorilla.mystore.previews",
  expectedBucket = "groomedgorilla.mystore.media",
  expectedHostname =
    "https://s3-eu-west-2.amazonaws.com/groomedgorilla.mystore.media",
  expectedMinSize = null,
  expectedMaxSize = null;

var s3;
const fs = require("fs");
const dbHelpers = require("../db/_helpers");
const fileHelpers = require("../../controllers/file/_helpers");

//TODO add authentication checks to all AWS routes (is Admin, isSoundEditor etc.)

module.exports = (app, aws) => {
  // Init S3, given your server-side keys.  Only needed if using the AWS SDK.
  s3 = new aws.S3();

  app.post("/s3/preview/uploadFile", (req, res, next) => {
    var filePath = `./audio/processing/${req.body.fileName}`;
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.status(500).send(`ERROR - S3 Preview Upload - ${err}`);
      }

      params = {
        Bucket: previewBucket,
        Key: req.body.fileName.replace(/[^\w\s]/gi, " "),
        Body: data,
      };

      s3.upload(params, (err, data) => {
        // console.log("PRINT FILE:", file);
        if (err) {
          console.log("ERROR - S3 Preview Upload - ", err);
          res.status(500).send(`ERROR - S3 Preview Upload - ${err}`);
        } else {
          console.log("Success - S3 Preview Upload");
          console.log("Data:", data);

          fs.unlink(filePath, (err) => {
            console.log(`${req.body.fileName} deleted`);
          });

          res.status(200).send({
            message: `Success - S3 Preview Uploaded [${req.body.fileName}]`,
            previewId: data.key,
          });
        }
      });
    });
  });

  app.post("/s3/preview/downloadFile", async (req, res, next) => {
    const params = {
      Bucket: expectedBucket,
      Key: req.body.fileKey,
    };
    console.log(`Downloading ${req.body.fileKey}`);
    var file = require("fs").createWriteStream(
      `./audio/processing/${req.body.fileKey}.${req.body.extension}`
    );
    await s3
      .getObject(params)
      .on("httpData", function (chunk) {
        file.write(chunk);
      })
      .on("httpDone", function () {
        file.end();
        console.log("file done");
        res.status(200).send(`File download success - ${req.body.fileKey}`);
      })
      .on("error", function (error) {
        console.log("Error! " + error);
        res
          .status(500)
          .send(
            `ERROR - File [${req.body.fileKey}] download failed - ${error}`
          );
      })
      .send();
  });

  // Return URL for preview playback
  app.get("/preview/:uuid", (req, res) => {
    var params = {
      Bucket: previewBucket,
      Key: `${req.params.uuid}`,
    };
    var url = s3.getSignedUrl("getObject", params);
    // console.log('The URL is', url);
    res.status(200).send(url);
  });

  // Return URL for file playback
  app.get("/audio/:uuid", async (req, res) => {
    var authorised = await dbHelpers.ownsSound(
      req.user.attributes.id,
      req.params.uuid
    );
    //check if user has purchased sound or is the original uploader + is authorised to access it

    if (authorised) {
      var params = {
        Bucket: expectedBucket,
        Key: `${req.params.uuid}`,
      };
      var url = s3.getSignedUrl("getObject", params);
      // console.log('The URL is', url);
      res.status(200).send(url);
    } else {
      res.status(403).send("You are not authorised to access this file");
    }
  });

  // Return audio file
  app.get("/audioFile/:uuid", async (req, res) => {
    var authorised = await dbHelpers.ownsSound(
      req.user.attributes.id,
      req.params.uuid
    );
    //check if user has purchased sound or is the original uploader + is authorised to access it

    if (authorised) {
      var params = {
        Bucket: expectedBucket,
        Key: `${req.params.uuid}`,
      };

      var url = s3.getSignedUrl("getObject", params);
      res.status(200).send(url);
    } else {
      res.status(403).send("You are not authorised to access this file");
    }
  });

  // Handles all signature requests and the success request FU S3 sends after the file is in S3
  // You will need to adjust these paths/conditions based on your setup.
  app.post("/s3handler", (req, res) => {
    if (typeof req.query.success !== "undefined") {
      verifyFileInS3(req, res);
    } else {
      signRequest(req, res);
    }
  });

  // Handles the standard DELETE (file) request sent by Fine Uploader S3.
  // Omit if you don't want to support this feature.
  app.delete("/s3handler/*", (req, res) => {
    deleteFile(req.query.bucket, req.query.key, function (err) {
      if (err) {
        console.log("Problem deleting file: " + err);
        res.status(500);
      }

      res.end();
    });
  });

  app.post("/s3/success", async (req, res, next) => {
    if (req.body.success != null) {
      if (req.body.success.length > 0) {
        var soundsAdded = await dbHelpers.addSounds(
          req.user.id,
          req.body.success
        );
        if (soundsAdded.success) {
          req.flash("lastUploads", req.body.success);
          req.flash("uploadMessage", soundsAdded.message);
          res.sendStatus(200);
        }
      }
    }
    next();
  });

  // Signs any requests.  Delegate to a more specific signer based on type of request.
  function signRequest(req, res) {
    if (req.body.headers) {
      signRestRequest(req, res);
    } else {
      signPolicy(req, res);
    }
  }

  // Signs multipart (chunked) requests.  Omit if you don't want to support chunking.
  function signRestRequest(req, res) {
    var version = req.query.v4 ? 4 : 2,
      stringToSign = req.body.headers,
      signature =
        version === 4
          ? signV4RestRequest(stringToSign)
          : signV2RestRequest(stringToSign);

    var jsonResponse = {
      signature: signature,
    };

    res.setHeader("Content-Type", "application/json");

    if (isValidRestRequest(stringToSign, version)) {
      res.end(JSON.stringify(jsonResponse));
    } else {
      res.status(400);
      res.end(
        JSON.stringify({
          invalid: true,
        })
      );
    }
  }

  function signV2RestRequest(headersStr) {
    return getV2SignatureKey(clientSecretKey, headersStr);
  }

  function signV4RestRequest(headersStr) {
    var matches = /.+\n.+\n(\d+)\/(.+)\/s3\/aws4_request\n([\s\S]+)/.exec(
        headersStr
      ),
      hashedCanonicalRequest = CryptoJS.SHA256(matches[3]),
      stringToSign = headersStr.replace(
        /(.+s3\/aws4_request\n)[\s\S]+/,
        "$1" + hashedCanonicalRequest
      );

    return getV4SignatureKey(
      clientSecretKey,
      matches[1],
      matches[2],
      "s3",
      stringToSign
    );
  }

  // Signs "simple" (non-chunked) upload requests.
  function signPolicy(req, res) {
    var policy = req.body,
      base64Policy = new Buffer(JSON.stringify(policy)).toString("base64"),
      signature = req.query.v4
        ? signV4Policy(policy, base64Policy)
        : signV2Policy(base64Policy);

    var jsonResponse = {
      policy: base64Policy,
      signature: signature,
    };

    res.setHeader("Content-Type", "application/json");

    if (isPolicyValid(req.body)) {
      res.end(JSON.stringify(jsonResponse));
    } else {
      res.status(400);
      res.end(
        JSON.stringify({
          invalid: true,
        })
      );
    }
  }

  function signV2Policy(base64Policy) {
    return getV2SignatureKey(clientSecretKey, base64Policy);
  }

  function signV4Policy(policy, base64Policy) {
    var conditions = policy.conditions,
      credentialCondition;

    for (var i = 0; i < conditions.length; i++) {
      credentialCondition = conditions[i]["x-amz-credential"];
      if (credentialCondition != null) {
        break;
      }
    }

    var matches = /.+\/(.+)\/(.+)\/s3\/aws4_request/.exec(credentialCondition);
    return getV4SignatureKey(
      clientSecretKey,
      matches[1],
      matches[2],
      "s3",
      base64Policy
    );
  }

  // Ensures the REST request is targeting the correct bucket.
  // Omit if you don't want to support chunking.
  function isValidRestRequest(headerStr, version) {
    if (version === 4) {
      return new RegExp("host:" + expectedHostname).exec(headerStr) != null;
    }

    return new RegExp("/" + expectedBucket + "/.+$").exec(headerStr) != null;
  }

  // Ensures the policy document associated with a "simple" (non-chunked) request is
  // targeting the correct bucket and the min/max-size is as expected.
  // Comment out the expectedMaxSize and expectedMinSize variables near
  // the top of this file to disable size validation on the policy document.
  function isPolicyValid(policy) {
    var bucket, parsedMaxSize, parsedMinSize, isValid;

    policy.conditions.forEach(function (condition) {
      if (condition.bucket) {
        bucket = condition.bucket;
      } else if (
        condition instanceof Array &&
        condition[0] === "content-length-range"
      ) {
        parsedMinSize = condition[1];
        parsedMaxSize = condition[2];
      }
    });

    isValid = bucket === expectedBucket;

    // If expectedMinSize and expectedMax size are not null (see above), then
    // ensure that the client and server have agreed upon the exact same
    // values.
    if (expectedMinSize != null && expectedMaxSize != null) {
      isValid =
        isValid &&
        parsedMinSize === expectedMinSize.toString() &&
        parsedMaxSize === expectedMaxSize.toString();
    }

    return isValid;
  }

  // After the file is in S3, make sure it isn't too big.
  // Omit if you don't have a max file size, or add more logic as required.
  function verifyFileInS3(req, res) {
    function headReceived(err, data) {
      if (err) {
        res.status(500);
        console.log(err);
        res.end(
          JSON.stringify({
            error: "Problem querying S3!",
          })
        );
      } else if (
        expectedMaxSize != null &&
        data.ContentLength > expectedMaxSize
      ) {
        res.status(400);
        res.write(
          JSON.stringify({
            error: "Too big!",
          })
        );
        deleteFile(req.body.bucket, req.body.key, function (err) {
          if (err) {
            console.log("Couldn't delete invalid file!");
          }

          res.end();
        });
      } else {
        res.end();
      }
    }

    callS3(
      "head",
      {
        bucket: req.body.bucket,
        key: req.body.key,
      },
      headReceived
    );
  }

  function getV2SignatureKey(key, stringToSign) {
    var words = CryptoJS.HmacSHA1(stringToSign, key);
    return CryptoJS.enc.Base64.stringify(words);
  }

  function getV4SignatureKey(
    key,
    dateStamp,
    regionName,
    serviceName,
    stringToSign
  ) {
    var kDate = CryptoJS.HmacSHA256(dateStamp, "AWS4" + key),
      kRegion = CryptoJS.HmacSHA256(regionName, kDate),
      kService = CryptoJS.HmacSHA256(serviceName, kRegion),
      kSigning = CryptoJS.HmacSHA256("aws4_request", kService);

    return CryptoJS.HmacSHA256(stringToSign, kSigning).toString();
  }

  function deleteFile(bucket, key, callback) {
    callS3(
      "delete",
      {
        bucket: bucket,
        key: key,
      },
      callback
    );
  }

  function callS3(type, spec, callback) {
    s3[type + "Object"](
      {
        Bucket: spec.bucket,
        Key: spec.key,
      },
      callback
    );
  }
};

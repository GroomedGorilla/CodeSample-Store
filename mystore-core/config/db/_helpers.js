var { Sound, Keyword } = require("../../app/models/sound");
var { Purchase } = require("../../app/models/purchase");
var User = require("../../app/models/user");
var {
  SoundKeyword,
  PurchaseSound,
  UserSound,
} = require("../../app/models/relations");
var { Category } = require("../../app/models/category");
var { BannerMsg } = require("../../app/models/bannerMsg");
const { sendPurchaseConfirmationEmail } = require("../../config/auth/mail");
var jobQueue = require("../../controllers/job-queue/client");

// SOUNDS
var addSounds = async (userId, files) => {
  var soundsAdded = [];
  for (let index = 0; index < files.length; index++) {
    const sound = files[index];
    const extension = sound.originalName.split(".").pop();
    console.log(`Dealing with sound: ${sound.name}`);
    var newSound = await insertSound(userId, sound);
    soundsAdded.push(newSound);
    //Watermarking
    jobQueue.queueWatermarkJob(userId, sound.uuid, extension, sound.available);

    // audioFn.processWatermark(userId, sound.uuid, addPreviewLocation); //generate watermark, upload and add preview location to DB
    console.log(`Starting tagging process for: ${sound.name}`);
    var newTags = await addTags(newSound.attributes.id, sound.tags);
    // console.log(`Tagging done for ${sound.name}`);
    // console.log(`Sound ${sound.name} added with tags`);
  }

  // console.log(soundsAdded);

  return {
    success: true,
    message: `${soundsAdded.length} Sounds Added`,
    soundsAdded,
  };
};

var insertSound = async (userId, file) => {
  var extension = file.originalName.split(".").pop();
  var categoryId = await fetchCategoryId(file.category, file.subCategory);
  return Sound.forge({
    soundEditor: userId,
    name: file.name,
    originalName: file.originalName,
    price: file.price,
    uuid: file.uuid,
    mimetype: file.mimetype,
    fileExtension: extension ? extension : null,
    category: categoryId,
    // imageLocation: null,
    // previewLocation: null,
    // synthesized: null,
    // soundModelID: null,
  }).save();
};

var fetchSounds = async (maxNum) => {
  var soundResults = Sound.where("available", 1)
    .query((qb) => {
      qb.limit(maxNum);
    })
    .orderBy(`created_at`, `DESC`)
    .fetchAll();

  return soundResults;
};

var paginateResults = (content, pageNum = 1, pageSize = 10) => {
  --pageNum; // because pages logically start with 1, but technically with 0
  var pageCount = Math.ceil(content.length / pageSize);
  return {
    pagedResults: content.slice(pageNum * pageSize, (pageNum + 1) * pageSize),
    pageCount: pageCount,
  };
};

var fetchSoundsById = async (soundIDs) => {
  var sounds = await Sound.where("id", "IN", soundIDs).fetchAll();

  return sounds.models.map((x) => x.attributes);
};

var fetchSoundById = async (soundID) => {
  var soundResult = await Sound.where("id", soundID).fetch();

  return soundResult;
};

var getSoundsByIDPaged = async (soundIDs, pageNum, pageSize = 10) => {
  var sounds = await Sound.where("id", "IN", soundIDs).fetchPage({
    pageSize: pageSize,
    page: pageNum,
  });

  return {
    success: true,
    message: "",
    sounds: sounds.models.map((x) => x.attributes),
    pageCount: sounds.pagination.pageCount,
  };
};

var fetchSoundID = async (uuid) => {
  var sound = await Sound.where("uuid", uuid).fetch({
    columns: ["id"],
  });
  return sound.id;
};

var querySounds = async (query) => {
  // is query similar to any file names?
  var sounds = await Sound.where("name", "LIKE", `%${query}%`).fetchAll();

  var keywordResults;
  //find keywords similar to query + their related sounds. Reduce all sound results to a single array
  await Keyword.where("keyword", "LIKE", `%${query}%`)
    .fetchAll({
      withRelated: ["sounds"],
    })
    .then((result) => {
      keywordResults = result.models
        .map((keyword) =>
          keyword.related("sounds").map((key) => key.attributes)
        )
        .reduce((p, n) => p.concat(n), []);
    });

  sounds = sounds.models.map((sound) => sound.attributes);
  var results = [...keywordResults, ...sounds];
  return results;
};

var getUserSounds = async (userID, pageNum = 0) => {
  var soundIDs = await getUserSoundIDs(userID);
  if (pageNum > 0) {
    let sounds = getSoundsByIDPaged(soundIDs, pageNum);
    return sounds;
    // * returns object with {success, message, sounds, pageCount}
  } else {
    return await fetchSoundsById(soundIDs);
  }
};

getSoundEditorSounds = async (userID, pageNum = 0) => {
  var soundIDs = await getSoundEditorSoundIDs(userID);
  if (pageNum > 0) {
    let sounds = getSoundsByIDPaged(soundIDs, pageNum);
    return sounds;
    // * returns object with {success, message, sounds, pageCount}
  } else {
    return await fetchSoundsById(soundIDs);
  }
};

var fetchSoundByUuid = (uuid) => {
  return Sound.where("uuid", uuid).fetch();
};

var addPreviewLocation = async (soundId, previewLoc) => {
  var sound;
  try {
    sound = await fetchSoundByUuid(soundId);
  } catch (e) {
    console.log(e);
  }

  if (!sound) {
    console.log("Sound not found");
    return false;
  }

  sound
    .set("available", true)
    .set("previewLocation", previewLoc)
    .save()
    .catch((err) => {
      console.log("Sound Update Error:", err);
      return false;
    });
};

var addPrevLocAndMetaData = async (
  soundId,
  previewLoc,
  metadata,
  available
) => {
  var sound;
  try {
    sound = await fetchSoundByUuid(soundId);
  } catch (e) {
    console.log(e);
  }

  if (!sound) {
    console.log("Sound not found");
    return false;
  }

  var formatLabels = [
    "lossless",
    "bitrate",
    "bitsPerSample",
    "duration",
    "numberOfChannels",
    "sampleRate",
  ];
  var commonLabels = ["artist", "copyright"];
  var changes = {};

  formatLabels.map((label) => {
    if (metadata.format[label] != "undefined") {
      changes[label] = metadata.format[label];
    }
  });

  commonLabels.map((label) => {
    if (metadata.common[label] != "undefined") {
      changes[label] = metadata.common[label];
    }
  });

  if (available && sound.attributes.price != null) {
    changes.available = true;
  }
  changes.previewLocation = previewLoc;

  return await sound
    .save(changes, {
      patch: true,
    })
    .then((res) => {
      return true;
    })
    .catch((err) => {
      console.log("Sound Update Error:", err);
      return false;
    });
};

var updateSoundDetails = async (soundUuid, details) => {
  var sound;
  var message;

  try {
    sound = await fetchSoundByUuid(soundUuid);
  } catch (e) {
    console.log(e);
  }

  if (!sound) {
    console.log("Sound not found");
    return {
      success: false,
      message: "",
      error: "Sound not found",
    };
  }

  var originalTags = await fetchSoundTags(soundUuid);
  var tags = parseTags(details.soundTags);

  delete details.soundTags;

  var categoryID = await fetchCategoryID(details.category, details.subCategory);

  delete details.subCategory;
  details.category = categoryID.id;

  var tagsToDelete = originalTags.filter((x) => !tags.includes(x));
  var newTagsToAdd = tags.filter((x) => !originalTags.includes(x));

  if (details.available && sound.attributes.previewLocation == "S3 Bucket") {
    details.available = false;
    message =
      "Watermarked file preview must be ready to be made available. Please contact support if this issue persists";
  }

  return await sound
    .save(details, {
      patch: true,
    })
    .then((updatedSound) => {
      if (tags !== "") {
        tagsToDelete.map(async (t) => {
          await deleteSoundTag(soundUuid, t);
        });
        var temp = newTagsToAdd.toString();
        addTags(sound.id, temp);
      }
      return {
        success: true,
        message: message ? message : `Sound details updated.`,
        error: null,
      };
    })
    .catch((err) => {
      console.log("Error in updating Sound Details", err);
      return {
        success: false,
        message: "",
        error: `Error in updating Sound Details: ${err}`,
      };
    });
};

//KEYWORDS
var insertTag = async (tag) => {
  var newTag = await Keyword.forge({
    keyword: tag,
  })
    .save()
    .catch((err) => {
      console.log(`dbInsertTag Error: ${err}`);
    });

  console.log(`New tag created for ${tag} : ${newTag}`);
  return newTag;
};

var fetchTagByText = async (tag) => {
  var tempKey = await Keyword.where("keyword", tag).fetch();

  return tempKey;
};

var fetchTagID = async (tag) => {
  var tagID = await Keyword.where("keyword", tag).fetch({
    columns: ["id"],
  });

  return tagID.id;
};

var relateSoundTag = async (soundId, tagId) => {
  return await SoundKeyword.forge({
    soundId: soundId,
    keywordId: tagId,
  })
    .save()
    .catch((error) => {
      console.error(error);
    });
};

var fetchSoundTags = async (uuid) => {
  var sound = await fetchSoundByUuid(uuid);

  var tagIDResults = await fetchSoundTagIDs(sound.id);
  var keywords = await fetchTagsByID(tagIDResults);
  return keywords; //array of keywords
};

var fetchSoundTagIDs = async (soundID) => {
  var tagIDResults = [];

  await SoundKeyword.where("soundID", soundID)
    .fetchAll({
      columns: ["keywordID"],
    })
    .then(async (keywordIDs) => {
      tagIDResults = keywordIDs.models.map((x) => x.attributes.keywordID);
    });

  return tagIDResults;
};

var fetchTagsByID = async (tagIDs) => {
  var keywords = await Keyword.where("id", "IN", tagIDs).fetchAll();

  return keywords.models.map((x) => x.attributes.keyword);
};

var addTags = async (soundID, tagString) => {
  var tags = parseTags(tagString);
  var tagId;

  var newTags = await Promise.all(
    tags.map(async (tag) => {
      var tempRes = await fetchTagByText(tag);
      if (!tempRes) {
        //if null
        //insert tag + get new tag id (set tagId)
        var newTag = await insertTag(tag);
        tagId = newTag.id;
      } else {
        //set tagId to found tag id
        // console.log(tempRes);
        tagId = tempRes.id;
      }
      await relateSoundTag(soundID, tagId);
      return tagId;
    })
  );

  // console.log(`Tags for sound ${soundID}: ${newTags}`);
  return newTags;
};

var parseTags = (tagString) => {
  tags = tagString
    .toLowerCase() //convert to lowercase
    .split(",") //split on comma
    .map((tag) => tag.trim()) //remove trailing whitespace
    .filter((v, i, a) => a.indexOf(v) === i) //remove duplicates
    .filter(Boolean); //remove empty strings
  return tags;
};

// PURCHASES
//Log purchase and relate to sounds
var addPurchase = async (charge, sounds, user) => {
  var purchase = await insertPurchase(charge);
  var items = [];

  for (var uuid in sounds) {
    var sound = await fetchSoundByUuid(uuid);
    relatePurchaseSound(purchase.attributes.id, sound.attributes.id);
    relateUserSound(charge.userID, sound.attributes.id);
    items.push(sound);
  }

  sendPurchaseConfirmationEmail(user, items, charge.totalGBP);
  return purchase.id;
};

var insertPurchase = async (charge) => {
  return Purchase.forge({
    userID: charge.userID,
    totalGBP: charge.totalGBP,
    itemCount: charge.itemCount,
    chargeID: charge.chargeID,
    error: null,
  }).save();
};

var relateUserSound = async (userID, soundID) => {
  return await UserSound.forge({
    soundID: soundID,
    userID: userID,
  })
    .save()
    .catch((error) => {
      console.error(error);
    });
};

var deleteSoundTag = async (soundUuid, tag) => {
  // get keyword ID
  // get sound ID
  // delete SoundKeyword where soundID and Keyword id match

  var soundKeyRelation;

  var tagID = await fetchTagID(tag);
  var soundID = await fetchSoundID(soundUuid);

  try {
    soundKeyRelation = await SoundKeyword.where({
      soundID: soundID,
      keywordID: tagID,
    }).destroy();
  } catch (err) {
    console.log("Sound Keyword Relation deletion Error:", err);
    return false;
  }

  if (soundKeyRelation) {
    console.log("Sound-Keyword Relation deleted.");
  }

  return true;
};

var relatePurchaseSound = async (purchaseId, soundId) => {
  return await PurchaseSound.forge({
    purchaseID: purchaseId,
    soundID: soundId,
  })
    .save()
    .catch((error) => {
      console.error(error);
    });
};

var getUserSoundIDs = async (userID) => {
  var soundResults = [];
  await UserSound.where("userID", userID)
    .fetchAll({
      columns: ["soundID"],
    })
    .then(async (soundIDs) => {
      soundResults = soundIDs.models.map((x) => x.attributes.soundID);
    });

  return soundResults;
};

var getSoundEditorSoundIDs = async (userID) => {
  var soundResults = [];
  await Sound.where("soundEditor", userID)
    .fetchAll({
      columns: ["id"],
    })
    .then(async (soundIDs) => {
      soundResults = soundIDs.models.map((x) => x.attributes.id);
    });

  return soundResults;
};

var ownsSound = async (userID, uuid) => {
  var sound = await fetchSoundByUuid(uuid);
  var purchasedSounds = await getUserSoundIDs(userID);
  var ownedSounds = await getSoundEditorSoundIDs(userID);
  return ownedSounds.includes(sound.id) || purchasedSounds.includes(sound.id);
};

var purchasedSound = async (userID, uuid) => {
  var sound = await fetchSoundByUuid(uuid);
  var purchasedSounds = await getUserSoundIDs(userID);
  return purchasedSounds.includes(sound.id);
};

// SOUND CATEGORIES

var fetchCategoryID = async (category, subCat) => {
  return Category.where("type", category)
    .where("name", subCat)
    .fetch({
      columns: ["id"],
    });
};

var fetchSoundCategories = async () => {
  var categoryResults = Category.where("type", "sound").fetchAll({
    columns: ["name"],
  });

  return categoryResults;
};

var fetchMusicCategories = async () => {
  var categoryResults = Category.where("type", "music").fetchAll({
    columns: ["name"],
  });

  return categoryResults;
};

var fetchSoundCategoryIDs = async () => {
  var categoryResults = Category.where("type", "sound").fetchAll({
    columns: ["id"],
  });

  return categoryResults;
};

var fetchMusicCategoryIDs = async () => {
  var categoryResults = Category.where("type", "music").fetchAll({
    columns: ["id"],
  });

  return categoryResults;
};

var fetchCategoryId = async (category, subcategory) => {
  var categoryRes = await Category.where("type", category)
    .where("name", subcategory)
    .fetch({
      columns: ["id"],
    });

  return categoryRes.attributes.id;
};

var fetchSoundCatByID = async (catID) => {
  return await Category.where("id", catID)
    .fetch()
    .then((model) => {
      //   remove ID and return category and sub-category
      return (({ id, ...others }) => ({
        ...others,
      }))(model.attributes);
    });
};

// SITE NOTIFICATIONS
var fetchAllBannerMsg = async () => {
  var bannerMsg = await BannerMsg.fetchAll();

  return bannerMsg.models.map((x) => x.attributes);
};

var fetchBannerMsg = async (type) => {
  var bannerMsg = await BannerMsg.where("type", type).fetchAll();

  return bannerMsg.models.map((x) => x.attributes);
};

// PAYMENTS / STRIPE

// DB RELATION TESTS
var getSoundsRelated = async (soundID) => {
  var results = await Sound.where("id", soundID)
    .fetch({
      withRelated: [
        "soundEditor",
        "keywords",
        "purchases",
        "category",
        "users",
      ],
    })
    .then((result) => {
      debugger;
      console.log(JSON.stringify(result.related("soundEditor")));
      console.log(JSON.stringify(result.related("keywords")));
      console.log(JSON.stringify(result.related("purchases")));
      console.log(JSON.stringify(result.related("category")));
      console.log(JSON.stringify(result.related("users")));
    });
};

var getPurchasesRelated = async (purchID) => {
  var results = await Purchase.where("id", purchID)
    .fetch({
      withRelated: ["sounds", "user"],
    })
    .then((result) => {
      debugger;
      console.log(result.related("sounds"));
      console.log(result.related("user"));
    });
};

var getUsersRelated = async (userID) => {
  var results = await User.where({
    id: userID,
  })
    .fetch({
      withRelated: ["uploads", "sounds"],
    })
    .then((result) => {
      debugger;
      console.log(result.related("uploads"));
      console.log(result.related("sounds"));
    });
};

var getKeywordsRelated = async (keywordID) => {
  var results = await Keyword.where("id", keywordID)
    .fetch({
      withRelated: ["sounds"],
    })
    .then((result) => {
      debugger;
      console.log(result.related("sounds"));
    });
};

var getCategoriesRelated = async (catID) => {
  var results = await Category.where("id", catID)
    .fetch({
      withRelated: ["sounds"],
    })
    .then((result) => {
      debugger;
      console.log(result.related("sounds"));
    });
};

// Admin - Support
var processSoundsWithoutPreview = async () => {
  return await Sound.where("previewLocation", "S3 Bucket")
    .fetchAll()
    .then((sounds) => {
      sounds.models.map((sound) =>
        jobQueue.queueWatermarkJob(
          sound.attributes.soundEditor,
          sound.attributes.uuid,
          sound.attributes.fileExtension
        )
      );
      return sounds.models.map((x) => x.attributes);
    })
    .catch((err) => {
      console.error(err);
      return null;
    });
};

var watermarkSoundByUUID = async (uuid) => {
  var sound = await fetchSoundByUuid(uuid);
  if (!sound) {
    return {
      success: false,
      message: "No sound found",
    };
  }
  jobQueue.queueWatermarkJob(
    sound.attributes.soundEditor,
    sound.attributes.uuid,
    sound.attributes.fileExtension
  );
  return {
    success: true,
    message: `${uuid} queued.`,
  };
};

module.exports = {
  addSounds,
  addTags,
  addPreviewLocation,
  addPrevLocAndMetaData,
  fetchSounds,
  fetchSoundByUuid,
  updateSoundDetails,
  addPurchase,
  getUserSoundIDs,
  getUserSounds,
  getSoundEditorSounds,
  fetchSoundsById,
  ownsSound,
  purchasedSound,
  fetchSoundTags,
  fetchMusicCategories,
  fetchSoundCategories,
  fetchMusicCategoryIDs,
  fetchSoundCategoryIDs,
  fetchCategoryId,
  fetchSoundCatByID,
  querySounds,
  fetchBannerMsg,
  fetchAllBannerMsg,

  getSoundsRelated,
  getPurchasesRelated,
  getUsersRelated,
  getKeywordsRelated,
  getCategoriesRelated,
  paginateResults,
  processSoundsWithoutPreview,
  watermarkSoundByUUID,
};

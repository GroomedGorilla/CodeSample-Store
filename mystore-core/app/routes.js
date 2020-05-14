// app/routes.js
const {
  // body,
  check,
  validationResult
} = require('express-validator/check');
const {
  // matchedData, sanitize,
  sanitizeBody,
  sanitizeQuery
} = require('express-validator/filter');
const {
  sendContactFormEmail,
  sendRegistrationConfirmationEmail
} = require('../config/auth/mail')
const multer = require('multer');
// MULTER DISK STORAGE
// var storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, '/tmp/uploads')
//   },
//   filename: function (req, file, cb) {
//     cb(null, file.fieldname + '-' + Date.now())
//   }
// })
// var upload = multer({ storage: storage});

// * MULTER MEMORY STORAGE
var storage = multer.memoryStorage()
var upload = multer({
  storage: storage
});
var _ = require('lodash');
// var upload = multer({ dest: 'uploads/' })


const fileHelpers = require('../controllers/file/_helpers');
const {
  checkPassTokenValidity,
  forgotPassword,
  isAdmin,
  isLoggedIn,
  isRegisteredSeller,
  isRegisteredSellerByUserID,
  notRegisteredSeller,
  isSoundEditor,
  isValidated,
  notLoggedIn,
  resendToken,
  resetPassword,
  updateProfileDetails,
  updateUserPass,
  verifyUser,
} = require('../config/auth/_helpers');
const dbHelpers = require('../config/db/_helpers');
const audioFn = require('../controllers/audio');
const stripeHelper = require('../controllers/stripe');

const jobQueue = require('../controllers/job-queue/client');
const Cart = require('./models/cart');

module.exports = (app, passport) => {

  app.get('/test', isAdmin, async (req, res) => {
    // sendPasswordResetEmail(req.user.attributes.email, 'tadaaa', 'randomtokeniser')
    res.status(200).send('Test route');
  })

  app.get('/admin', isAdmin, async (req, res) => {
    var successMsg = req.flash('success')[0];
    var bannerMsg = await dbHelpers.fetchAllBannerMsg();
    var soundsWithoutPreview = req.flash('soundsQueued');

    res.render('admin.ejs', {
      bannerMessage: bannerMsg,
      errorMessage: req.flash('errorMessage'),
      message: req.flash('message'),
      noMessage: !successMsg,
      successMsg: successMsg,
      soundsQueued: (soundsWithoutPreview.length > 0 ? soundsWithoutPreview.map(s => s.uuid) : null),
      user: (req.user ? req.user.attributes : null),
    });
  })

  app.post('/admin/watermark', isAdmin, [
    check('uuid', 'Name cannot be blank').isLength({
      min: 1
    }),
    sanitizeBody('uuid').trim().escape()
  ], async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      var errMsgs = errors.array().map(err => err.msg);
      req.flash('errorMessage', errMsgs);
      req.session.save(() => {
        res.redirect('/admin');
      });
    } else {
      var result = await dbHelpers.watermarkSoundByUUID(req.body.uuid)
      if (result.success) {
        req.flash('success', result.message);
      } else {
        req.flash('errorMessage', result.message);
      }
      req.session.save(() => {
        res.redirect('/admin');
      });
    }
  })

  app.post('/admin/watermark-all', isAdmin, async (req, res) => {
    var sounds = await dbHelpers.processSoundsWithoutPreview();
    if (sounds) {
      req.flash('soundsQueued', sounds);
    } else {
      req.flash('errorMessage', "No sounds queued");
    }
    req.session.save(() => {
      res.redirect('/admin');
    });
  })

  // ! TODO secure / remove
  app.get('/listAudio', isAdmin, (req, res) => {
    var fileList = fileHelpers.listAudioFiles();
    res.status(200).send(fileList);
  })

  // * HOME PAGE (with login links) ========
  app.get('/', async (req, res) => {
    if (req.isAuthenticated()) {
      res.redirect('/home');
    } else {
      res.render('index.ejs', {
        user: null,
        errorMessage: req.flash('errorMessage'),
      }); // load the index.ejs file
    }
  });

  // * AUTHORISED HOME PAGE ========
  app.get('/home', isLoggedIn, [
    sanitizeQuery('search').trim().escape().blacklist(`<>&'"/`)
  ], async (req, res) => {
    var successMsg = req.flash('success')[0];
    let queryParams = (({
      page,
      ...others
    }) => ({
      ...others
    }))(req.query);

    var userSoundIDs = await dbHelpers.getUserSoundIDs(req.user.attributes.id);
    //TODO Consider storing categories in req.session
    await dbHelpers.fetchMusicCategories()
      .then(async fetchedMusicCats => {
        await dbHelpers.fetchSoundCategories()
          .then(async fetchedSoundCats => {
            // soundsCats = fetchedSoundCats.models.map(sound => sound.attributes);
            // musicCats = fetchedMusicCats.models.map(sound => sound.attributes);

            var currentPage = 1;
            var sounds = [];
            var searchRes = [];
            var unmatchedSounds = [];
            var categoryIds = [];

            var bannerMsg = await dbHelpers.fetchAllBannerMsg(); //fetchBannerMsg('system');

            // debugger;
            // Can we get Category IDs from fetchedSoundCats and fetchedMusicCats??

            // If we've reached this page via search
            if (req.query.category) {
              const errors = validationResult(req);
              // if (!errors.isEmpty()) {
              //   debugger;

              // }
              req.session.search = req.query;
              // Find requested Category IDs for filtering
              switch (req.query.subCategory) {
                case 'anySfxCat':
                  var catIds = await dbHelpers.fetchSoundCategoryIDs();
                  categoryIds = catIds.models.map(cat => cat.attributes.id);
                  break;
                case 'anyMusicCat':
                  var catIds = await dbHelpers.fetchMusicCategoryIDs();
                  categoryIds = catIds.models.map(cat => cat.attributes.id);
                  break;
                case undefined:
                  //no category specified = do nothing
                  break;
                default: {
                  categoryIds = [await dbHelpers.fetchCategoryId(req.query.category, req.query.subCategory)];
                }
              }

              var searchTerms = req.query.search.replace(/[&\/\\#,+\-()$~%.'":*?<>{}]/g, ' ').split(/[ ,]+/);
              await Promise.all(searchTerms.map(x => dbHelpers.querySounds(x)))
                .then(data => {
                  var results = [];
                  data.map(x => {
                    results.push(...x)
                  })
                  searchRes = _.uniqBy(results, 'id');
                })

              switch (req.query.sort) {
                case 'priceHigh':
                  searchRes = _.orderBy(searchRes, ['price', 'name'], ['desc', 'asc']);
                  break;

                case 'priceLow':
                  searchRes = _.orderBy(searchRes, ['price', 'name'], ['asc', 'asc']);
                  break;

                case 'date':
                  searchRes = _.orderBy(searchRes, ['created_at', 'name'], ['desc', 'asc']);
                  break;

                case 'editor':
                  //TODO
                  break;

                default:
                  //sort by name
                  searchRes = _.orderBy(searchRes, ['name'], ['asc']);
                  break;
              }

              // If filtering was requested, filter results + provide suggestions
              if (categoryIds.length > 0) {
                unmatchedSounds = searchRes.filter(snd => !categoryIds.includes(snd.category));
                searchRes = searchRes.filter(snd => categoryIds.includes(snd.category));
              }

              //paginate results
              if (req.query.page > 0) {
                currentPage = req.query.page;
              }
              searchRes = dbHelpers.paginateResults(searchRes, currentPage, 10);

            } else {
              req.session.search = null;
              await dbHelpers.fetchSounds(100)
                .then(fetchedSounds => {
                  sounds = fetchedSounds.models.map(sound => sound.attributes);
                })
            }

            let pageVars = {
              bannerMessage: bannerMsg,
              errorMessage: req.flash('errorMessage'),
              musicCategories: _.sortBy(fetchedMusicCats.models.map(sound => sound.attributes), 'name'),
              noMessage: !successMsg,
              owned: userSoundIDs.filter((v, i, a) => a.indexOf(v) === i),
              searchResults: searchRes.pagedResults,
              similarResults: unmatchedSounds.slice(0,10),
              soundCategories: _.sortBy(fetchedSoundCats.models.map(sound => sound.attributes), 'name'),
              soundsList: sounds,
              successMsg: successMsg,
              user: req.user.attributes, // get the user out of session and pass to template
            }

            if (req.query.category) {
              pageVars.pages = {
                current: currentPage,
                total: searchRes.pageCount
              };

              //stringify query string
              var queryStr = '';
              Object.keys(queryParams).map((key, index) => {
                queryStr = `${queryStr}&${key}=${queryParams[key]}`
              })
              pageVars.queryStr = queryStr.slice(1);
            }

            res.render('home.ejs', pageVars); // load the home.ejs file
          })
      })
      .catch(err => {
        console.log(err);
      });
  });

  // * PROFILE SECTION =====================
  // we will want this protected so you have to be logged in to visit
  // we will use route middleware to verify this (the isLoggedIn function)
  app.get('/profile', isLoggedIn, async (req, res) => {
    var successMsg = req.flash('success')[0];
    var bannerMsg = await dbHelpers.fetchAllBannerMsg();

    res.render('profile.ejs', {
      bannerMessage: bannerMsg,
      errorMessage: req.flash('errorMessage'),
      successMsg: successMsg,
      noMessage: !successMsg,
      user: req.user.attributes, // get the user out of session and pass to template
    });
  });

  app.post('/profile', isLoggedIn, [
    check('name', 'Name cannot be blank').isLength({
      min: 1
    }),
    check('surname', 'Surname cannot be blank').isLength({
      min: 1
    }),
    check('email', 'Please enter a valid email address').isEmail(),
    check('email', 'Email cannot be blank').isLength({
      min: 1
    }),
    // check('password', 'Password must be more than 6 characters long').isLength({
    //   min: 6
    // }),
    sanitizeBody('email').normalizeEmail({
      lowercase: true
    }),
    sanitizeBody('name').trim().escape(),
    sanitizeBody('surname').trim().escape(),
    sanitizeBody('profession').trim().escape(),
    sanitizeBody('dob').toDate()
  ], async (req, res, next) => {
    //validate
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      var errMsgs = errors.array().map(err => err.msg);
      req.flash('errorMessage', errMsgs);
      req.session.save(() => {
        res.redirect('/profile');
      });
    } else {
      var updateOK = await updateProfileDetails(req);
      updateOK ? req.flash('success', "Your details have been updated. You'll be sent an email to confirm this.") : req.flash('success', "No changes found.");

      req.session.save(() => {
        res.redirect('/profile');
      });
    }
  });

  app.post('/profile/changepass', isLoggedIn, [
    check('oldPass', 'Password must be at least 8 characters long')
    .isLength({
      min: 8
    }),

    check('newPass', 'Password must be at least 8 characters long')
    .isLength({
      min: 8
    }),
    check('newPass', 'Passwords must match').custom((newPass, {
      req
    }) => req.body.confirmPass === newPass),
    check('newPass', 'Passwords must be at least 8 characters long and include a combination of numbers, letters and symbols.')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[@$!%*?#.&])[A-Za-z0-9@$!%*?#.&]{8,}.*$/, 'g'),
  ], async (req, res, next) => {
    //validate
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      var errMsgs = errors.array().map(err => err.msg);
      req.flash('errorMessage', errMsgs);
      req.session.save(() => {
        res.redirect('/profile');
      });
    } else {
      // var updateOK = await updateProfileDetails(req);
      // updateOK ? req.flash('message', "Your details have been updated. You'll be sent an email to confirm this.") : req.flash('message', "No changes found.");

      updateUserPass(req)
        .then((response) => {
          response.success ? req.flash('success', response.message) : req.flash('errorMessage', response.message);

          // * Fix for flash messages not showing up until after refresh
          req.session.save(() => {
            res.redirect('/profile');
          });
        })
    }
  })

  app.get('/seller-reg', isLoggedIn, isSoundEditor, notRegisteredSeller, async (req, res) => {
    var bannerMsg = await dbHelpers.fetchAllBannerMsg();

    res.render('connect_register.ejs', {
      bannerMessage: bannerMsg,
      errorMessage: req.flash('errorMessage'),
      message: req.flash('message'),
      user: req.user.attributes, // get the user out of session and pass to template
    });
  });

  app.post('/seller-reg', isLoggedIn, isSoundEditor, notRegisteredSeller, async (req, res, next) => {
    debugger; //check stripe_status
    var regInfo = req.body;
    regInfo.userID = req.user.attributes.id;
    if (!req.user.attributes.stripe_status) {
      stripeHelper.createCustomAccount(regInfo);
      stripeHelper.setStripeStatus(req.user.attributes.id, `pending`);
      req.flash('success', "Your Seller Registration has been received and is pending approval.");
      sendRegistrationConfirmationEmail(req.user.attributes);
    } else {
      req.flash('errorMessage', 'This account is already a registered seller or has already applied to be one. If you believe something is wrong with your account please contact support for further assistance.');
    }
    req.session.save(() => {
      res.redirect('/profile')
    });
    // next(); //TODO FOR TESTING Replace above 2 lines with this
  });

  app.post('/hook-account', async (req, res) => {
    // Retrieve the request's body and parse it as JSON
    let sig = req.headers["stripe-signature"];
    try {
      let event = stripeHelper.stripe.webhooks.constructEvent(req.body, sig, stripeHelper.stripeEndpointSecret_account);
      console.info(`Account Event:\n ${JSON.stringify(event)}`);
      // * CHECK IF LIVEMODE IN CASE OF TEST WEBHOOK EVENT
    } catch (err) {
      console.log(`Webhook Signature error:\n ${err}`);
      res.status(400).end()
    }

    var reqHook = JSON.parse(req.body.toString());
    res.sendStatus(200); // Return a response to acknowledge receipt of the event

    console.log(reqHook.type);
    console.log(reqHook);

    if (reqHook.livemode) {
      /* Do something with event_json */
    }

  });

  app.post('/hook-connect', async (req, res) => {
    // Retrieve the request's body and parse it as JSON
    let sig = req.headers["stripe-signature"];
    try {
      let event = stripeHelper.stripe.webhooks.constructEvent(req.body, sig, stripeHelper.stripeEndpointSecret_connect);
      // console.log(`Connect Event:\n ${JSON.stringify(event)}`);
      // * CHECK IF LIVEMODE IN CASE OF TEST WEBHOOK EVENT

      var reqHook = JSON.parse(req.body.toString());
      res.sendStatus(200); // Return a response to acknowledge receipt of the event
      console.log(reqHook.type);
      console.log(reqHook);

      // Check account/person requirements due
      var reqs = reqHook.data.object.requirements;
      debugger;
      switch (reqHook.type) {
        case 'person.updated':
          break;

        case 'account.updated':
          if (reqHook.data.object.requirements.disabled_reason !== null) {
            stripeHelper.setDeauthorisedSeller(reqHook.data.object.metadata.user_id, req);
            debugger;
          } else {
            const noReqsDue = Object.keys(reqs)
              .filter(x => {
                return /_due$/.test(x);
              })
              .map(x => reqs[x].length)
              .every(y => y == 0);

            debugger;

            if (noReqsDue && reqHook.data.object.metadata.user_id) {
              // debugger;
              // var reggd = await isRegisteredSellerByUserID(reqHook.data.object.metadata.user_id);
              // if (!reggd) { //If user isn't already a registered seller, set attribute
              await stripeHelper.setRegisteredSeller(reqHook.data.object.metadata.user_id, req);
              // }
            } else {
              // sets status to 'reqs_due' and emails user
              await stripeHelper.setSellerRequirementsDue(reqHook.data.object.metadata.user_id, req)

              var dueReqs = {
                dueDate: reqHook.data.object.requirements.current_deadline,
                currentlyDue: reqHook.data.object.requirements.currently_due,
                eventuallyDue: reqHook.data.object.requirements.eventually_due,
                pastDue: reqHook.data.object.requirements.eventually_due.past_due,
              }
              debugger; //check values in dueReqs
              // console.info(JSON.stringify(dueReqs))
              // console.log(reqs);
            }
          }
          break;

        default:
          break;
      }

      if (reqHook.livemode) {
        /* Do something with event_json */
      }
    } catch (err) {
      console.log(`Webhook Signature error:\n ${err}`);
      res.status(400).end()
    }
  });

  // * MY PURCHASES ==============================
  app.get('/purchases/:page(\\d+)?', isLoggedIn, async (req, res) => {
    var soundResults;
    var currentPage = 1;
    var bannerMsg = await dbHelpers.fetchAllBannerMsg();
    if (req.params.page > 0) {
      currentPage = req.params.page;
    }
    soundResults = await dbHelpers.getUserSounds(req.user.attributes.id, currentPage);

    res.render('purchases.ejs', {
      bannerMessage: bannerMsg,
      message: req.flash('message'),
      errorMessage: req.flash('errorMessage'),
      user: req.user.attributes, // get the user out of session and pass to template
      soundsList: (soundResults.sounds ? soundResults.sounds : []),
      pages: {
        current: currentPage,
        total: soundResults.pageCount
      },
    });
  });

  // * MY SOUNDS (SOUND EDITORS) ==============================
  app.get('/mysounds/:page(\\d+)?', isLoggedIn, isValidated, isRegisteredSeller, async (req, res) => {
    var soundResults;
    var currentPage = 1;
    var bannerMsg = await dbHelpers.fetchAllBannerMsg();
    if (req.params.page > 0) {
      currentPage = req.params.page;
    }
    soundResults = await dbHelpers.getSoundEditorSounds(req.user.attributes.id, currentPage)

    await dbHelpers.fetchMusicCategories()
      .then(async fetchedMusic => {
        await dbHelpers.fetchSoundCategories()
          .then(
            fetchedSounds => {
              soundResults.sounds = soundResults.sounds.map(async sound => {
                var keywords = await dbHelpers.fetchSoundTags(sound.uuid);
                var category = await dbHelpers.fetchSoundCatByID(sound.category);
                sound.keywords = keywords;
                sound.category = category.type;
                sound.subcat = category.name;
                return sound;
              })

              Promise.all(soundResults.sounds)
                .then((sounds) => {
                  res.render('mysounds.ejs', {
                    bannerMessage: bannerMsg,
                    errorMessage: req.flash('errorMessage'),
                    message: req.flash('message'),
                    musicCategories: _.sortBy(fetchedMusic.models.map(sound => sound.attributes), 'name'),
                    soundsList: (sounds ? sounds : []),
                    pages: {
                      current: currentPage,
                      total: soundResults.pageCount
                    },
                    soundCategories: _.sortBy(fetchedSounds.models.map(sound => sound.attributes), 'name'),
                    user: req.user.attributes,
                  });
                })
            })
      });
  });

  app.post('/mysounds/:sound', isLoggedIn, [
    check('name', 'Name cannot be blank').isLength({
      min: 1
    }),
    sanitizeBody('name').trim().escape(),
  ], async (req, res, next) => {
    //validate
    const errors = validationResult(req);

    var soundID = req.params.sound;

    if (!errors.isEmpty()) {
      var errMsgs = errors.array().map(err => err.msg);
      res.status(400).send(errMsgs);
    } else {
      var updateOK = await dbHelpers.updateSoundDetails(soundID, req.body);
      res.status(200).send(updateOK.message);
    }
    next();
  });

  // FILE UPLOAD ==============================
  app.get('/upload', isLoggedIn, isValidated, isRegisteredSeller, async (req, res) => {
    var bannerMsg = await dbHelpers.fetchAllBannerMsg();
    await dbHelpers.fetchMusicCategories()
      .then(async fetchedMusic => {
        await dbHelpers.fetchSoundCategories()
          .then(
            fetchedSounds => {
              soundsCats = fetchedSounds.models.map(sound => sound.attributes);
              musicCats = fetchedMusic.models.map(sound => sound.attributes);
              res.render('upload.ejs', {
                bannerMessage: bannerMsg,
                message: req.flash('uploadMessage'),
                errorMessage: req.flash('errorMessage'),
                files: req.flash('lastUploads'),
                user: req.user.attributes,
                soundCategories: _.sortBy(fetchedSounds.models.map(sound => sound.attributes), 'name'),
                musicCategories: _.sortBy(fetchedMusic.models.map(sound => sound.attributes), 'name')
              });
            }
          )
        // var sounds = fetchedSounds.models.map(sound => sound.attributes);
      })
      .catch(err => {
        console.log(err);
      });
  });

  // app.post('/upload', isLoggedIn, isSoundEditor, (req, res) => {
  //   console.log('POST Upload')
  // });

  // ADD TO CART ==============================
  app.get('/addToCart/:id', isLoggedIn, isValidated, async (req, res) => {
    var productId = req.params.id;
    var cart = new Cart(req.session.cart ? req.session.cart : {});

    var sound;
    try {
      sound = await dbHelpers.fetchSoundByUuid(productId);
    } catch (error) {
      console.log(error);
    }

    if (!sound) {
      console.log('Sound not found');
      res.redirect('/');
    } else {
      if (!(await dbHelpers.ownsSound(req.user.id, sound.attributes.uuid))) {
        cart.add(sound.attributes, sound.attributes.uuid);
      }
      req.session.cart = cart;
      res.redirect('/');
    }
  });

  app.get('/removeFromCart/:id', async (req, res, next) => {
    var productId = req.params.id;
    var cart = new Cart(req.session.cart ? req.session.cart : {});

    cart.removeItem(productId);
    req.session.cart = (cart.totalQty > 0 ? cart : null);
    req.session.save(() => {
      res.redirect('/basket');
    });
  });

  app.get('/basket', isLoggedIn, isValidated, async (req, res, next) => {
    var successMsg = req.flash('success')[0];
    var bannerMsg = await dbHelpers.fetchAllBannerMsg();

    if (!req.session.cart) {
      return res.render('basket.ejs', {
        bannerMessage: bannerMsg,
        noMessage: !successMsg,
        successMsg: successMsg,
        products: null,
        user: req.user.attributes
      });
    }

    var cart = new Cart(req.session.cart);
    res.render('basket.ejs', {
      bannerMessage: bannerMsg,
      noMessage: !successMsg,
      successMsg: successMsg,
      products: cart.generateArray(),
      totalPrice: cart.totalPrice,
      user: req.user.attributes
    })
  })

  app.get('/checkout', isLoggedIn, isValidated, async (req, res, next) => {
    var bannerMsg = await dbHelpers.fetchAllBannerMsg();

    if (!req.session.cart) {
      return res.redirect('/basket');
    }

    var cart = new Cart(req.session.cart);
    var errMsg = req.flash('error')[0];
    res.render('checkout.ejs', {
      bannerMessage: bannerMsg,
      total: cart.totalPrice,
      products: cart.generateArray(),
      errMsg: errMsg,
      noErrors: !errMsg,
      user: req.user.attributes
    });
  })

  // LOGOUT ==============================
  app.get('/logout', isLoggedIn, (req, res) => {
    req.logout();
    res.redirect('/');
  });

  // LOGIN ===============================
  app.get('/login', notLoggedIn, (req, res) => {
    // render the page and pass in any flash data if it exists
    res.render('login.ejs', {
      user: null,
      message: req.flash('loginMessage'),
      errorMessage: req.flash('errorMessage')
    });
  });

  // process the login form
  app.post('/login', notLoggedIn, [
    check('email', 'Please enter a valid email address').isEmail(),
    check('email', 'Email cannot be blank').isLength({
      min: 1
    }),
    check('password', 'Password must be at least 8 characters long')
    .isLength({
      min: 8
    }),
    check('password', 'Password must be at least 8 characters long and include a combination of numbers, letters and symbols.')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[@$!%*?#.&])[A-Za-z0-9@$!%*?#.&]{8,}.*$/, 'g'),
    sanitizeBody('email').trim().normalizeEmail({
      lowercase: true
    }),
  ], (req, res, next) => {
    //validate form
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.render('login.ejs', {
        message: req.flash('loginMessage'),
        errorMessage: errors.array().map(err => err.msg)
      });
    } else {
      passport.authenticate('local-login', {
        successRedirect: '/home',
        failureRedirect: '/login',
        failureFlash: true
      })(req, res);
    }
  });


  // SIGNUP ==============================
  app.get('/signup', notLoggedIn, (req, res) => {

    // render the page and pass in any flash data if it exists
    res.render('signup.ejs', {
      user: null,
      message: req.flash('signupMessage')
    });
  });

  app.post('/signup', notLoggedIn, [
    check('name', 'Name cannot be blank').isLength({
      min: 1
    }),
    check('surname', 'Surname cannot be blank').isLength({
      min: 1
    }),
    check('email', 'Please enter a valid email address').isEmail(),
    check('email', 'Email cannot be blank').isLength({
      min: 1
    }),
    check('password', 'Password must be at least 8 characters long')
    .isLength({
      min: 8
    }),
    check('password', 'Passwords must match').custom((password, {
      req
    }) => req.body.confirmPass === password),
    check('password', 'Passwords must be at least 8 characters long and include a combination of numbers, letters and symbols.')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[@$!%*?#.&])[A-Za-z0-9@$!%*?#.&]{8,}.*$/, 'g'),
    sanitizeBody('email').normalizeEmail({
      lowercase: true
    }),
    sanitizeBody('name').trim().escape(),
    sanitizeBody('surname').trim().escape()
  ], (req, res, next) => {

    //validate
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.render('signup.ejs', {
        message: errors.array().map(err => err.msg)
      });
    } else {
      passport.authenticate('local-signup', (err, user, info) => {
        if (err || !user) {
          if (info !== undefined) {
            req.flash('signupMessage', info.message);
          }
          req.session.save(() => {
            res.redirect('/signup');
          });
        }
        req.flash('loginMessage', `Sign-up successful! Please click the link in the verification email we've just sent you to complete your account!`);
        req.session.save(() => {
          res.redirect('/login')
        });
      })(req, res);

      console.log(req.user);

      // req.logout();
    }
  });

  // ACCOUNT VALIDATION ==================
  app.get('/verify/:token', notLoggedIn, async (req, res, next) => {

    var userVal = await verifyUser(req.params.token);

    // console.log('userval', userVal);

    if (userVal.success === true) {
      req.flash('loginMessage', userVal.message);
    } else {
      req.flash('errorMessage', userVal.message);
    }
    req.session.save(() => {
      res.redirect('/login');
    });
  });

  app.get('/resend', notLoggedIn, (req, res) => {
    res.render('resend.ejs', {
      user: null,
      message: req.flash('resendMessage'),
      errorMessage: req.flash('errorMessage')
    });
  });

  app.post('/resend', notLoggedIn, [
    check('email', 'Please enter a valid email address').isEmail(),
    check('email', 'Email cannot be blank').isLength({
      min: 1
    }),
    check('password', 'Password must be at least 8 characters long')
    .isLength({
      min: 8
    }),
    check('password', 'Passwords must be at least 8 characters long and include a combination of numbers, letters and symbols.')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[@$!%*?#.&])[A-Za-z0-9@$!%*?#.&]{8,}.*$/, 'g'),
    sanitizeBody('email').normalizeEmail({
      lowercase: true
    })
  ], async (req, res, next) => {
    //validate
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.render('resend.ejs', {
        errorMessage: errors.array().map(err => err.msg)
      });
    } else {
      var resend = await resendToken(req)

      if (!resend.success) {
        req.flash('errorMessage', resend.message);
      } else {
        req.flash('resendMessage', `Verification email resent to ${req.body.email}`)
      }

      req.session.save(() => {
        res.redirect('/resend');
      });
    }
  });


  // FORGOT PASS ==============================
  app.get('/forgot', notLoggedIn, (req, res) => {
    res.render('forgot.ejs', {
      user: null,
      message: req.flash('forgotMessage'),
      errorMessage: req.flash('errorMessage')
    });
  });

  app.post('/forgot', notLoggedIn, [
    check('email', 'Please enter a valid email address').isEmail(),
    check('email', 'Email cannot be blank').isLength({
      min: 1
    }),
    sanitizeBody('email').normalizeEmail({
      lowercase: true
    })
  ], async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.render('forgot.ejs', {
        message: req.flash('forgotMessage'),
        errorMessage: errors.array().map(err => err.msg)
      });
    } else {
      var forgot = await forgotPassword(req);

      if (!forgot.success) {
        console.log(`Error encountered: ${forgot.message}`)
      }

      req.flash('forgotMessage', forgot.message);
      req.session.save(() => {
        res.redirect('/forgot');
      });
    }
  })

  // PASS RESET ==============================
  app.get('/reset/:token', notLoggedIn, async (req, res, next) => {
    var validToken = await checkPassTokenValidity(req.params.token);

    if (!validToken.success) {
      req.flash('forgotMessage', validToken.message);
      req.session.save(() => {
        res.redirect('/forgot');
      });
    } else {
      res.render('reset.ejs', {
        user: null,
        message: req.flash('resetMessage'),
        errorMessage: req.flash('errorMessage'),
        token: req.params.token
      });
    }
  });

  app.post('/reset', notLoggedIn, [
    check('password', 'Password must be at least 8 characters long')
    .isLength({
      min: 8
    }),
    check('password', 'Passwords must match').custom((password, {
      req
    }) => req.body.confirmPass === password),
    check('password', 'Passwords must be at least 8 characters long and include a combination of numbers, letters and symbols.')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[@$!%*?#.&])[A-Za-z0-9@$!%*?#.&]{8,}.*$/, 'g'),
  ], async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      // res.redirect(`/reset/${req.body.token}`);

      res.render('reset.ejs', {
        message: req.flash('resetMessage'),
        errorMessage: errors.array().map(err => err.msg),
        token: req.body.token
      });
    } else {

      var reset = await resetPassword(req.body.token, req.body.password)

      if (!reset.success) {
        req.flash('errorMessage', reset.message);

        // res.render('reset.ejs', {
        //   message: req.flash('resetMessage'),
        //   errorMessage: req.flash(''),
        //   token: req.body.token
        // });
        req.session.save(() => {
          res.redirect(`/reset/${req.body.token}`);
        });

      } else {
        req.flash('loginMessage', reset.message)
        req.session.save(() => {
          res.redirect('/login');
        });
      }
    }
  });


  app.get('/contact', async (req, res) => {
    var successMsg = req.flash('success')[0];
    var bannerMsg = await dbHelpers.fetchAllBannerMsg();

    res.render('contact.ejs', {
      bannerMessage: bannerMsg,
      errorMessage: req.flash('errorMessage'),
      message: req.flash('message'),
      noMessage: !successMsg,
      successMsg: successMsg,
      user: (req.user ? req.user.attributes : null),
    });
  })

  app.post('/contact', [
    check('name', 'Name cannot be blank').isLength({
      min: 1
    }),
    check('email', 'Please enter a valid email address').isEmail(),
    check('email', 'Email cannot be blank').isLength({
      min: 1
    }),
    sanitizeBody('email').normalizeEmail({
      lowercase: true
    }),
    sanitizeBody('name').trim().escape(),
    sanitizeBody('subject').trim().escape(),
    sanitizeBody('message').trim().escape()
  ], (req, res) => {
    const errors = validationResult(req);
    req.session.contact = req.body;
    if (!errors.isEmpty()) {
      var errMsgs = errors.array().map(err => err.msg);
      req.flash('errorMessage', errMsgs);
      req.session.save(() => {
        res.redirect('/contact');
      });
    } else {
      req.session.contact = null;
      sendContactFormEmail(req.body.name, req.body.email, req.body.subject, req.body.message);
      req.flash('success', 'Your message has been received');
      req.session.save(() => {
        res.redirect('/contact');
      });
    }
  })

  app.get('/privacy', async (req, res) => {
    var successMsg = req.flash('success')[0];
    var bannerMsg = await dbHelpers.fetchAllBannerMsg();

    res.render('privacy.ejs', {
      bannerMessage: bannerMsg,
      errorMessage: req.flash('errorMessage'),
      message: req.flash('message'),
      noMessage: !successMsg,
      successMsg: successMsg,
      user: (req.user ? req.user.attributes : null),
    });
  })

  app.get('/terms', async (req, res) => {
    var successMsg = req.flash('success')[0];
    var bannerMsg = await dbHelpers.fetchAllBannerMsg();

    res.render('terms.ejs', {
      bannerMessage: bannerMsg,
      errorMessage: req.flash('errorMessage'),
      message: req.flash('message'),
      noMessage: !successMsg,
      successMsg: successMsg,
      user: (req.user ? req.user.attributes : null),
    });
  })


  app.get('*', (req, res, next) => {
    // const error = new Error('Page Not Found');
    // error.status = 404;
    // next(error);
    res.status(404).render('404.ejs', {
      user: (req.user ? req.user.attributes : null),
    });
  })

};
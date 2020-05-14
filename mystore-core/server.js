const express = require('express'),
  passport = require('passport'),
  flash = require('connect-flash'),
  morgan = require('morgan'),
  cookieParser = require('cookie-parser'),
  bodyParser = require('body-parser'),
  session = require('express-session'),
  validator = require('express-validator'),
  aws = require('aws-sdk'),
  favicon = require('serve-favicon'),
  path = require('path'),
  kue = require('kue'),
  kueUiExpress = require('kue-ui-express'),
  MySQLStore = require('connect-session-knex')(session),
  {isAdmin} = require('./config/auth/_helpers');

var {
  knexConnection
} = require('./bookshelf');

var app = express();
app.set('view engine', 'ejs'); // set up ejs for templating

var port = process.env.PORT || 8080;
var serverPublicKey = process.env.S3_PUBLIC_KEY;
var serverSecretKey = process.env.S3_SECRET_KEY;

// configuration ===============================================================
require('./config/auth/passport')(passport); // pass passport for configuration

// set up our express application
app.use(morgan('dev')); // log every request to the console // ! TODO CHANGE?
app.post('/hook-account', bodyParser.raw({type: '*/*'})) // * Included this since webhooks require RAW body
app.post('/hook-connect', bodyParser.raw({type: '*/*'})) // * Included this since webhooks require RAW body
app.use(bodyParser.json()); // * Needed to encode POST data into req.body
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(cookieParser()); // read cookies (needed for auth)
// required for passport
app.use(session({
  secret: 'julianz', //TODO obviously needs revision. Demo purposes onlly
  resave: false, //if true, session will be saved on server on each request
  saveUninitialized: false, //if true, session will be stored on server even if uninitialised
  store: new MySQLStore({
    knex: knexConnection
  }),
  cookie: {
    maxAge: 3 * 24 * 60 * 60 * 1000 //3 Days
  }
})); // session secret //TODO change
app.use(flash()); // use connect-flash for flash messages stored in session
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions

app.use('/static', express.static('public'))
app.use('/fine-uploader', express.static(__dirname + '/node_modules/fine-uploader'));
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

app.use((req, res, next) => {
  res.locals.login = req.isAuthenticated();//set local variable
  res.locals.session = req.session;
  next();
})

aws.config.update({
  accessKeyId: serverPublicKey,
  secretAccessKey: serverSecretKey,
  region: 'eu-west-2'
});

let queue = kue.createQueue({
  prefix: 'q', // Can change this value incase you're using multiple apps using same
  // redis instance.
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: 6379 // default
  }
});

kueUiExpress(app, '/kue/', '/kue-api');

// Mount kue JSON api
app.use('/kue-api/', isAdmin, kue.app);

// routes ======================================================================
require('./config/filehandler/aws.js')(app, aws); //load AWS signature routes + functions
//TODO Split out routes
require('./app/routes/payments.js')(app);
require('./app/routes.js')(app, passport); // load our routes and pass in our app and fully configured passport
require('./controllers/job-queue/worker');

//TODO Error Handling
app.use((error, req, res, next) => {
  res.status(error.status || 500);
  res.json({
    error: {
      message: error.message
    }
  });
});

// launch ======================================================================
app.listen(port);
console.log('Site launching on port ', port);
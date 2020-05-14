// config/auth/passport.js

var LocalStrategy = require("passport-local").Strategy;
// var FacebookStrategy   = require('passport-facebook').Strategy;

const authHelpers = require("./_helpers");
// const configAuth = require('./auth');
var User = require("../../app/models/user");

// expose this function to our app using module.exports
module.exports = (passport) => {
  // passport session setup ==================================================
  // required for persistent login sessions
  // passport needs ability to serialize and unserialize users out of session

  // used to serialize the user for the session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // used to deserialize the user
  // TODO: Test if working (implementation using bookshelf model)
  passport.deserializeUser((id, done) => {
    User.where("id", id)
      .fetch()
      .then((user) => {
        done(null, user);
      })
      .catch((err) => {
        done(err);
      });
  });

  // Local Signup / Login
  // ===================================================
  passport.use(
    "local-signup",
    new LocalStrategy(
      {
        // by default, local strategy uses username and password, we will override with email
        usernameField: "email",
        passwordField: "password",
        passReqToCallback: true, // allows us to pass back the entire request to the callback
      },
      (req, email, password, done) => {
        process.nextTick(async () => {
          var user;
          try {
            user = await authHelpers.findUserByEmail(req.body.email);
          } catch (e) {
            console.log(`Error finding User by Email: ${e}`);
          }

          try {
            if (user) {
              console.log(`User found ${user}`);
              return done(null, false, {
                message: "An account already exists for this email.",
              });
            } else {
              authHelpers.signupUser(req).then((user) => {
                return done(null, user);
              });
            }
          } catch (err) {
            return done(err);
          }
        });
      }
    )
  );

  passport.use(
    "local-login",
    new LocalStrategy(
      {
        // by default, local strategy uses username and password, we will override with email
        usernameField: "email",
        passwordField: "password",
        passReqToCallback: true, // allows us to pass back the entire request to the callback
      },
      async (req, email, password, done) => {
        var user;
        try {
          user = await authHelpers.findUserByEmail(req.body.email);
        } catch (e) {
          console.log(`Error finding User by Email: ${e}`);
        }

        try {
          if (!user)
            return done(
              null,
              false,
              req.flash("errorMessage", "No user found")
            );

          if (!user.get("validated")) {
            return done(
              null,
              false,
              req.flash(
                "errorMessage",
                "This account has not been verified. Please check your mailbox."
              )
            );
          }

          if (!authHelpers.comparePass(req.body.password, user.get("password")))
            //TODO refactor to take user object
            return done(
              null,
              false,
              req.flash("errorMessage", "Incorrect email or password.")
            );
        } catch (e) {
          return done(err);
        }

        return done(null, user);
      }
    )
  );

  // // Facebook Signup / Login
  // // ===================================================
  //
  // passport.use(new FacebookStrategy({
  //   clientID : configAuth.facebookAuth.clientID,
  //   clientSecret : configAuth.facebookAuth.clientSecret,
  //   callbackURL : configAuth.facebookAuth.callbackURL
  // },
  //
  // function(token, refreshToken, profile, done) {
  //   // asynchronous
  //   process.nextTick(function() {
  //
  //     User.where('facebook.id', profile.id)
  //     .fetch()
  //     .then(function(user) {
  //
  //       if(user) {
  //         return done(null, user); //user found, return user
  //       } else {
  //
  //       }
  //         return done(null, false, req.flash('signupMessage', "An account already exists for this email."));
  //       } else {
  //         authHelpers.createUser({'name' : req.body.name, 'surname' : req.body.surname, 'email' : email, 'password' : password})
  //         .then((user) => {
  //           return done(null, user);
  //         });
  //       }
  //     }).catch((err) => { return done(err) });
  //
  //
  //   })
  // }
  //
  // ))
};

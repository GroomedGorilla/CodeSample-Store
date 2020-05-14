const bcrypt = require("bcrypt-nodejs");
const mailer = require("./mail");
var crypto = require("crypto");
var User = require("../../app/models/user");
var { Token, PassToken } = require("../../app/models/token");

var comparePass = (userPassword, databasePassword) => {
  return bcrypt.compareSync(userPassword, databasePassword);
};

var compareDates = (date, days) => {
  date.setDate(date.getDate() + days);
  return new Date() > date;
};

var compareHours = (date, hours) => {
  date.setHours(date.getHours() + hours);
  return new Date() > date;
};

var hashPassword = (pass) => {
  const salt = bcrypt.genSaltSync(8);
  const hash = bcrypt.hashSync(pass, salt, null);
  return hash;
};

var createUser = async (req) => {
  var hash = hashPassword(req.body.password);

  return await User.forge({
    //TODO possible don't need await
    name: req.body.name,
    surname: req.body.surname,
    email: req.body.email,
    password: hash,
  }).save();
};

var signupUser = async (req, res, next) => {
  // console.log("Req is: ", JSON.stringify(req.headers));

  var newUser;
  try {
    newUser = await createUser(req);
  } catch (e) {
    console.log("Create User error", e);
  }

  var userToken = await generateUserToken(newUser);

  mailer.sendVerificationEmail(
    newUser.attributes.email,
    userToken.attributes.token
  );

  return newUser;
};

var generateUserToken = async (user) => {
  var tokenVal = generateToken();
  var token = await Token.forge({
    userID: user.id,
    token: tokenVal,
  }).save();

  console.log(`Generated token ${tokenVal} for user ${user.id}`);

  return token;
};

var generatePassToken = async (user) => {
  var tokenPass = generateToken();
  var passToken = await PassToken.forge({
    //TODO possible don't need await
    userID: user.id,
    token: tokenPass,
  }).save();

  console.log(`Generated token ${tokenPass} for user ${user.id}`);

  return passToken;
};

var generateToken = () => {
  return crypto.randomBytes(16).toString("hex");
};

var findUserByID = (userID) => {
  return User.where("id", userID).fetch();
};

var findUserByEmail = (email) => {
  return User.where("email", email).fetch();
};

var findUserByStripeID = (stripeID) => {
  return User.where("stripeID", stripeID).fetch();
};

var findUserIDByToken = (token) => {
  return Token.where("token", token).fetch({
    columns: ["userID", "created_at"],
  });
};

var findUserIDByPassToken = (passToken) => {
  return PassToken.where("token", passToken).fetch({
    columns: ["userID", "created_at"],
  });
};

var verifyUser = async (token) => {
  var usrID;

  try {
    usrID = await findUserIDByToken(token);
  } catch (e) {
    return {
      success: false,
      message: `Token error: ${e}`,
    };
  }

  if (!usrID) {
    return {
      success: false,
      message: `Invalid token used. Tokens must be used within 24 hours. <a href="/resend">Click here to request a new verification link</a>`,
    };
  }

  var expiredToken = compareDates(usrID.attributes.created_at, 1);

  if (expiredToken) {
    return {
      success: false,
      message: `Invalid token used. Tokens must be used within 24 hours. <a href="/resend">Click here to request a new verification link</a>`,
    };
  }

  var valid = await validateUser(usrID.attributes.userID);

  await clearExpiredTokens();
  console.log("Expired tokens cleared");

  if (!valid) {
    return {
      success: false,
      message: "User not found",
    };
  }

  return {
    success: true,
    message: "Account successfully verified. Please login.",
  };
};

var validateUser = async (userID) => {
  var result = false;
  await User.where("id", userID)
    .fetch()
    .then(async (user) => {
      if (!user) {
        console.log("User not found");
        result = false;
      } else {
        await user
          .save(
            {
              validated: true,
            },
            {
              patch: true,
            }
          )
          .then(async (validatedUser) => {
            console.log(`User ${user.id} validated.`);
            var deleted;
            try {
              deleted = await deleteUserToken(userID);
            } catch (err) {
              console.log("Delete token error:", err);
              result = false;
            }
            result = deleted;
          })
          .catch((err) => {
            console.log("User Validation Error:", err);
            result = false;
          });
      }
    });

  return result;
};

var forgotPassword = async (req) => {
  var user = await findUserByEmail(req.body.email);

  if (!user) {
    return {
      success: false,
      message: "No user found",
    };
  }

  var passToken;
  try {
    passToken = await generatePassToken(user);
  } catch (e) {
    console.log(e);
  }

  mailer.sendPasswordResetEmail(
    user.attributes.email,
    passToken.attributes.token
  );

  return {
    success: true,
    message: `You'll shortly receive an email at ${user.attributes.email} if the account exists, with instructions to reset your account password.`,
  };
};

var resetPassword = async (passToken, password) => {
  var usrID;

  try {
    usrID = await findUserIDByPassToken(passToken);
  } catch (e) {
    return {
      success: false,
      message: `Token error: ${e}`,
    };
  }

  if (!usrID) {
    return {
      success: false,
      message: "Invalid token used. Tokens must be used within 1 hour.",
    };
  }

  var expiredToken = compareHours(usrID.attributes.created_at, 1);

  if (expiredToken) {
    return {
      success: false,
      message: "This link has expired. Tokens must be used within 1 hour.",
    };
  }

  var reset = await setUserPass(usrID.attributes.userID, password, true);

  await clearExpiredPassTokens();
  console.log("Expired password tokens cleared");

  if (!reset) {
    return {
      success: false,
      message: "User not found",
    };
  }

  return {
    success: true,
    message: "Your password has been reset successfully. Please login.",
  };
};

var setUserPass = async (userID, password, deleteToken = false) => {
  var result = false;
  await User.where("id", userID)
    .fetch()
    .then(async (user) => {
      if (!user) {
        console.log("User not found");
        result = false;
      } else {
        var hash = hashPassword(password);
        await user
          .save(
            {
              password: hash,
            },
            {
              patch: true,
            }
          )
          .then(async (updatedUser) => {
            console.log(`Password Reset for ${user.id}.`);
            if (deleteToken) {
              var deleted;
              try {
                deleted = await deleteUserPassToken(userID);
              } catch (err) {
                console.log("Delete password token error:", err);
                result = false;
              }
              result = deleted;
            }
            result = true;
          })
          .catch((err) => {
            console.log("Password Reset:", err);
            result = false;
          });
      }
    });

  return result;
};

var checkTokenValidity = async (token) => {
  var tokenDate = await Token.where("token", passToken).fetch({
    columns: ["created_at"],
  });

  if (!tokenDate) {
    return {
      success: false,
      message: "Invalid token used. Tokens must be used within 1 hour.",
    };
  }

  var expiredToken = compareHours(tokenDate.attributes.created_at, 1);

  if (expiredToken)
    return {
      success: false,
      message: "This link has expired. Tokens must be used within 1 hour.",
    };

  return {
    success: true,
    message: "",
  };
};

var checkPassTokenValidity = async (passToken) => {
  var passTokenDate = await PassToken.where("token", passToken).fetch({
    columns: ["created_at"],
  });

  if (!passTokenDate) {
    return {
      success: false,
      message: "Invalid token used. Tokens must be used within 1 hour.",
    };
  }

  var expiredToken = compareHours(passTokenDate.attributes.created_at, 1);

  if (expiredToken)
    return {
      success: false,
      message: "This link has expired. Tokens must be used within 1 hour.",
    };

  return {
    success: true,
    message: "",
  };
};

var resendToken = async (req) => {
  // find user by email
  var user;
  var generated;
  user = await findUserByEmail(req.body.email);

  if (!user) {
    return {
      success: false,
      message: "Incorrect login details",
    };
  }
  // check if password is correct
  var validPass = comparePass(req.body.password, user.get("password"));

  if (!validPass) {
    return {
      success: false,
      message: "Incorrect login details",
    };
  }

  if (user.get("validated")) {
    await deleteUserToken(user.attributes.id);
    clearExpiredTokens();
    return {
      success: false,
      message: "Account is already validated",
    };
  }

  try {
    // delete all user tokens
    var deleted = await deleteUserToken(user.attributes.id);

    // generate new token
    generated = await generateUserToken(user);
  } catch (e) {
    console.log(e);
  }
  // send email
  mailer.sendVerificationEmail(
    user.attributes.email,
    generated.attributes.token
  );
  clearExpiredTokens();

  return {
    success: true,
    message: null,
  };
};

var deleteUserToken = async (userID) => {
  var token;

  try {
    token = await Token.where("userID", userID).destroy();
  } catch (err) {
    console.log("User token deletion Error:", err);
    return false;
  }

  if (token) {
    console.log("Token deleted for user:", userID);
  }

  return true;
};

var deleteUserPassToken = async (userID) => {
  var passToken;

  try {
    passToken = await PassToken.where("userID", userID).destroy();
  } catch (err) {
    console.log("User password token deletion Error:", err);
    return false;
  }

  if (passToken) {
    console.log("Password Token deleted for user:", userID);
  }

  return true;
};

var clearExpiredTokens = async () => {
  var date = new Date();

  date.setDate(date.getDate() - 1);

  var token;
  try {
    token = await Token.where("created_at", "<", date).destroy();
  } catch (e) {
    console.log("Token deletion error", e);
  }

  console.log("Deleted", token);
};

var clearExpiredPassTokens = async () => {
  var date = new Date();

  date.setHours(date.getHours() - 1); //Created over 1 hour ago

  var passToken;
  try {
    passToken = await Token.where("created_at", "<", date).destroy();
  } catch (e) {
    console.log("Token deletion error", e);
  }

  console.log("Deleted Pass Token", passToken);
};

var updateProfileDetails = async (req) => {
  var userID = req.user.attributes.id;
  var details = req.body;
  var user;
  var result = false;

  await User.where("id", userID)
    .fetch()
    .then(async (user) => {
      if (!user) {
        console.log("User not found");
        result = false;
      } else {
        var labels = ["name", "surname", "email", "profession"];
        var changes = {};

        labels.map((label) => {
          if (user.attributes[label] != details[label]) {
            changes[label] = details[label];
          }
        });

        if (user.attributes.dob) {
          if (user.attributes.dob.valueOf() != details.dob.valueOf()) {
            changes.dob = details.dob;
          }
        } else {
          changes.dob = details.dob;
        }

        //building object containing fields to be changed
        //Using spread operator to change 'changes' object, if details.dob exists/is true, then include dob:details.dob etc.
        // changes = { ...changes,
        //   ...(details.dob && {
        //     dob: details.dob
        //   }),
        //   ...(details.profession && {
        //     profession: details.profession
        //   })
        // }

        var emptyChanges =
          Object.keys(changes).length === 0 && changes.constructor === Object;

        if (!emptyChanges) {
          await user
            .save(changes, {
              patch: true,
            })
            .then((updatedUser) => {
              mailer.sendProfileChangeEmail(user.attributes, changes);
              result = true;
            })
            .catch((err) => {
              console.log("Error in updating User Details", err);
              result = false;
            });
        }
      }
    });

  return result;
};

var updateUserPass = async (req) => {
  var oldPass = req.body.oldPass;
  var newPass = req.body.newPass;
  var userID = req.user.attributes.id;
  // find user
  var user;
  try {
    user = await findUserByID(userID);
    console.log(`User found = ${user}`);
  } catch (e) {
    console.log(e);
  }

  if (!user) {
    console.log("User not found");
    return {
      success: false,
      message: "User not found",
    };
  }

  // confirm old password
  var validPass = comparePass(oldPass, user.get("password"));
  if (!validPass) {
    return {
      success: false,
      message: "Password provided was incorrect.",
    };
  }

  // set new password
  var reset = await setUserPass(userID, newPass);

  await clearExpiredPassTokens();
  console.log("Expired password tokens cleared");

  if (!reset) {
    return {
      success: false,
      message: "User not found",
    };
  }

  mailer.sendPasswordChangeEmail(user.attributes);

  return {
    success: true,
    message: `Your password has been updated. You'll receive an email to confirm this change.`,
  };
};

// route middleware to make sure a user is logged in
const isLoggedIn = (req, res, next) => {
  // if user is authenticated in the session, carry on
  if (req.isAuthenticated()) return next();

  // if they aren't redirect them to the home page
  res.redirect("/");
};

const notLoggedIn = (req, res, next) => {
  // if user is authenticated in the session, carry on
  if (!req.isAuthenticated()) return next();

  // if they aren't redirect them to the home page
  res.redirect("/");
};

const isSoundEditor = (req, res, next) => {
  if (req.user.attributes.soundEditor) return next();

  res.redirect("/");
};

const isRegisteredSellerByUserID = async (userID) => {
  var user = await User.where("id", userID)
    .where("registeredSeller", true)
    .fetch();

  if (user) {
    return true;
  }
  return false;
};

const isRegisteredSeller = (req, res, next) => {
  // if user has been registered via Stripe as a seller, carry on
  if (req.user.attributes.registeredSeller) return next();

  // if they aren't redirect them to the home page
  res.redirect("/");
};

const notRegisteredSeller = (req, res, next) => {
  // if user is not yet registered as a seller through Stripe Connect
  if (!req.user.attributes.registeredSeller) return next();

  // if they are, this route is not for them
  res.redirect("/");
};

const isValidated = (req, res, next) => {
  if (req.user.attributes.validated) return next();

  req.flash(
    "errorMessage",
    "Please be sure to activate your account by following the link in your verification email"
  );
  res.redirect("/");
  // res.redirect('/logout') ?
};

var isAdmin = (req, res, next) => {
  if (req.user && req.user.attributes.admin) return next();

  req.flash("errorMessage", "You are not authorised to perform this action.");
  req.session.save(() => {
    res.redirect(303, `/home`);
  });
};

module.exports = {
  checkPassTokenValidity,
  comparePass,
  findUserByEmail,
  findUserByID,
  forgotPassword,
  isAdmin,
  isLoggedIn,
  isRegisteredSeller,
  isRegisteredSellerByUserID,
  isSoundEditor,
  isValidated,
  notLoggedIn,
  notRegisteredSeller,
  resendToken,
  resetPassword,
  signupUser,
  updateProfileDetails,
  updateUserPass,
  verifyUser,
};

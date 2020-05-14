const axios = require("axios");
const { findUserByID } = require("../config/auth/_helpers");
var User = require("../app/models/user");
const mailer = require("../config/auth/mail");
var stripe = require("stripe")("stripe secret key"); //KEY REMOVED
const stripeEndpointSecret_account = process.env.STRIPE_ACCOUNT_ENDPOINT_SECRET;
const stripeEndpointSecret_connect = process.env.STRIPE_CONNECT_ENDPOINT_SECRET;

// * Once user connects Stripe account to platform,
// * this fn uses the provided code to retrieve the seller's Stripe user ID
var resolveSellerStripeID = async (userID, code) => {
  debugger;
  var result = {
    success: false,
    message: null,
  };

  // * Resolve code to Seller Stripe ID
  await axios
    .post("https://connect.stripe.com/oauth/token", {
      client_secret: process.env.STRIPE_SECRET,
      code: code,
      grant_type: `authorization_code`,
    })
    .then(async (response) => {
      result.success = await setSellerStripeID(
        userID,
        response.data.stripe_user_id
      );
    })
    .catch((err) => {
      debugger;
      // ! Something went wrong.
      console.log(err);
      return {
        success: false,
        message: `Something went wrong in resolveSellerStripeID: ${err}`,
      };
    });

  debugger;

  return result;
};

var calcStripeFee = (totalCharge, eu = true) => {
  // * Returns Stripe fee (in cents) based on Cart total
  // For UK based platform:
  // - 20p + 1.4% of charge for EU
  // - 20p + 2.9% of charge for non-EU cards
  return eu ? 20 + 0.014 * totalCharge : 20 + 0.029 * totalCharge;
};

var createCustomAccount = (account) => {
  var accountInfo = {
    type: "custom",
    country: account.country,
    email: account.email,
    account_token: account.account_token,
    external_account: account.external_token,
    metadata: {
      user_id: account.userID,
    },
  };

  if (account.country == "US") {
    accountInfo.requested_capabilities = ["card_payments"];
  }

  debugger;
  stripe.accounts.create(accountInfo, async function (err, acc) {
    if (!err) {
      if (account.person_token) {
        stripe.accounts.createPerson(
          acc.id,
          {
            person_token: account.person_token,
          },
          (err, person_id) => {
            if (!err) {
              debugger;
              stripe.tokens.create(
                {
                  account: {
                    company: {
                      owners_provided: true,
                    },
                  },
                },
                async function (err, token) {
                  if (!err) {
                    stripe.accounts.update(
                      acc.id,
                      {
                        account_token: token.id,
                      },
                      async function (err, acct_upd) {
                        if (!err) {
                          debugger;
                          console.log(
                            `Account updated: ${JSON.stringify(account)}`
                          );
                          await setSellerStripeID(account.userID, acc.id);
                        } else {
                          console.log(`Error in updating Account: ${err}`);
                          debugger;
                        }
                      }
                    );
                  } else {
                    console.log(`Error in updating Account: ${err}`);
                    debugger;
                  }
                }
              );
            } else {
              console.log(`Error in creation Person: ${err}`);
              debugger;
            }
          }
        );
      } else {
        await setSellerStripeID(account.userID, acc.id);
      }
    } else {
      //TODO handle error
      debugger;
    }
  });
};

var setSellerStripeID = async (userID, acct_id) => {
  return await User.where("id", userID)
    .fetch()
    .then(async (user) => {
      if (!user) {
        console.log("User not found");
        return false;
      } else {
        await user
          .save(
            {
              stripeID: acct_id,
            },
            {
              patch: true,
            }
          )
          .then((updatedUser) => {
            debugger;
            console.log(`Stripe ID linked to User: ${acct_id}`);
            return true;
          })
          .catch((err) => {
            console.log("Error in updating User Details", err);
            return false;
          });
      }
    });
  return false;
};

var setRegisteredSeller = async (userID) => {
  return await User.where("id", userID)
    .where("registeredSeller", false)
    .fetch()
    .then((user) => {
      if (!user) {
        console.log("User not found or already confirmed");
        return false;
      } else {
        user
          .save(
            {
              registeredSeller: true,
            },
            {
              patch: true,
            }
          )
          .then((updatedUser) => {
            console.log("User Registered As Seller");
            setStripeStatus(userID, `confirmed`);
            mailer.sendSellerRegisteredEmail(user.attributes);
            return true;
          })
          .catch((err) => {
            console.log("Error in updating User Details", err);
            return false;
          });
      }
    })
    .catch((err) => {
      console.log("Error in updating User Details", err);
    });
  return false;
};

var setDeauthorisedSeller = async (userID) => {
  return await User.where("id", userID)
    .where("registeredSeller", true)
    .fetch()
    .then((user) => {
      if (!user) {
        console.log("Seller not found or already inactive");
        return false;
      } else {
        user
          .save(
            {
              registeredSeller: false,
            },
            {
              patch: true,
            }
          )
          .then(async (updatedUser) => {
            console.log("Seller De-Authorised");
            var statusSet = await setStripeStatus(userID, `disabled`);
            if ((statusSet.success == true) & (statusSet.message == null)) {
              mailer.sendSellerDeauthorisedEmail(user.attributes);
            }
            return true;
          })
          .catch((err) => {
            console.log("Error in updating User Details", err);
            return false;
          });
      }
    })
    .catch((err) => {
      console.log("Error in updating User Details", err);
    });
  return false;
};

var setSellerRequirementsDue = async (userID) => {
  return await User.where("id", userID)
    .fetch()
    .then((user) => {
      if (!user) {
        console.log("Seller not found or already inactive");
        return false;
      } else {
        user
          .save(
            {
              registeredSeller: false,
            },
            {
              patch: true,
            }
          )
          .then(async (updatedUser) => {
            console.log("Seller - Requirements Due");
            var statusSet = await setStripeStatus(userID, `reqs_due`);
            if ((statusSet.success == true) & (statusSet.message == null)) {
              mailer.sendRequirementsDueEmail(user.attributes);
            }
            return true;
          })
          .catch((err) => {
            console.log("Error in updating User Details", err);
            return false;
          });
      }
    })
    .catch((err) => {
      console.log("Error in updating User Details", err);
    });
  return false;
};

var getStripeStatus = async (userID) => {
  var user;
  var result = {
    success: false,
    status: null,
    message: null,
  };

  try {
    user = await findUserByID(userID);
  } catch (e) {
    console.log(e);
    result.message = e;
  }

  if (user) {
    result.success = true;
    result.status = user.get("stripe_status");
  }

  return result;
};

var setStripeStatus = async (userID, status) => {
  var user;
  var result = {
    success: false,
    message: null,
  };

  await User.where("id", userID)
    .fetch()
    .then(async (user) => {
      if (!user) {
        console.log("User not found");
        result.message = "User not found";
        return result;
      } else {
        debugger;
        if (user.attributes.stripe_status !== status) {
          await user
            .save(
              {
                stripe_status: status,
              },
              {
                patch: true,
              }
            )
            .then((updatedUser) => {
              console.log(`Stripe status updated: ${status}`);
              result.success = true;
            })
            .catch((err) => {
              console.log("Error in updating User Details", err);
              result.message = `Error in updating User Details ${err}`;
              return result;
            });
        } else {
          result = {
            success: true,
            message: "No Change",
          };
        }
      }
    });
  return result;
};

// var updateStripeAccount = async (stripeID, updateToken) => {
//     debugger;
//     await stripe.accounts.update(
//         stripeID,
//         updateToken,
//         function (err, account) {
//             if (!err) {
//                 debugger;
//                 console.log(`Account updated: ${account}`);
//             } else {
//                 console.log(`Error in updating Account: ${err}`);
//                 debugger;
//             }
//         }
//     );
// }

module.exports = {
  calcStripeFee,
  createCustomAccount,
  getStripeStatus,
  resolveSellerStripeID, //TODO remove
  setDeauthorisedSeller,
  setRegisteredSeller,
  setSellerRequirementsDue,
  setSellerStripeID,
  setStripeStatus,
  stripe,
  stripeEndpointSecret_account,
  stripeEndpointSecret_connect,
};

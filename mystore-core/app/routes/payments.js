const {
    isLoggedIn,
    findUserByID
} = require('../../config/auth/_helpers');
const {
    addPurchase,
} = require('../../config/db/_helpers');
const {
    calcStripeFee
} = require('../../controllers/stripe');
var stripe = require("stripe")(process.env.STRIPE_SECRET);
const Cart = require('../models/cart');
const euCountries = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "GB"];

module.exports = (app) => {

    app.post('/checkout', isLoggedIn, async (req, res, next) => {
        if (!req.session.cart) {
            req.session.save(() => {
                return res.redirect('/basket');
            });
        }

        var cart = new Cart(req.session.cart);
        var user = await findUserByID(req.session.passport.user);
        // Token is created using Checkout or Elements!
        // Get the payment token ID submitted by the form:
        const token = req.body.stripeToken; // Using Express
        const itemIDs = Object.keys(cart.items).map(x => {
            return cart.items[x].item.id
        });


        await stripe.charges.create({
            amount: cart.totalPrice,
            currency: 'gbp',
            source: req.body.stripeToken, // obtained with Stripe.js
            description: `${req.session.cart.totalQty} items purchased`,
            statement_descriptor: 'MyStore',
            metadata: {
                user_id: req.session.passport.user,
                cart_items: itemIDs.toString(),
            },
            receipt_email: `${req.user.attributes.email}`
        }, async function (err, charge) {
            // asynchronously called
            if (err) {
                req.flash('error', err.message);
                req.session.save(() => {
                    return res.redirect('/checkout');
                });
            } else {
                let cardCountry = charge.payment_method_details.card.country;

                // * Can check fraud rating here

                req.flash('success', 'Payment Successful');

                let purchID = await addPurchase({
                        userID: req.session.passport.user,
                        totalGBP: charge.amount,
                        itemCount: cart.totalQty,
                        chargeID: charge.id
                    },
                    cart.items,
                    user);

                //update charge with transfer group (purchase id)
                const transferGrp = `purch_${purchID}`;
                stripe.charges.update(
                    charge.id, {
                        transfer_group: transferGrp
                    },
                    function (err, charge) {
                        if (!err) {
                            // * Seller Payout Handled Here
                            var stripeFee = calcStripeFee(charge.amount, euCountries.includes(cardCountry));

                            // - Custom % Application Fee. Stripe Fee paid by Sellers
                            var cartItems = Object.keys(cart.items).map(function (key) {
                                return cart.items[key].item;
                            });

                            // find unique seller IDs from cart
                            var sellerIds = cartItems.map(item => item.soundEditor)
                                .filter((v, i, a) => a.indexOf(v) === i)

                            sellerIds.map(async id => {
                                // For each seller:
                                // calculate total per seller from cart
                                var sellerTotal = cartItems
                                    .filter(item => {
                                        return item.soundEditor == id
                                    })
                                    .map(x => x.price)
                                    .reduce((prev, next) => prev + next)

                                // calculate basket %
                                var basketPerc = (sellerTotal / cart.totalPrice);

                                // fetch seller % by ID + calculate application fee
                                //TODO Bundle the following into functions (calculateSellerPayout + createTransfer)
                                await findUserByID(id)
                                    .then(seller => {
                                        var platformFee = (seller.attributes.platform_fee_perc / 10000) * sellerTotal;
                                        var sellerStripeFee = (basketPerc * stripeFee);
                                        // * seller total - application fee - stripe fee
                                        var sellerPayout = Math.floor(sellerTotal - platformFee - sellerStripeFee);

                                        // create transfer for each
                                        stripe.transfers.create({
                                            amount: sellerPayout,
                                            currency: "gbp",
                                            source_transaction: charge.id,
                                            destination: seller.attributes.stripeID,
                                            transfer_group: transferGrp,
                                        }).then(function (transfer) {

                                        }, function (err) {
                                            debugger;
                                            console.error(`Error in creating transfer: ${err}`);
                                        });
                                    })
                            })

                        } else {
                            debugger;
                            console.log(`Charge Update Error: ${err}`)
                        }
                    }
                );
                req.session.cart = null;
                req.session.save(() => {
                    res.redirect('/');
                });
            }
        });

    })
}
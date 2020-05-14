const api_key = "mailgun key"; //KEY REMOVED
const domain = "mystore.com";
const mg_host = "api.eu.mailgun.net";
const mailgun = require("mailgun-js")({
  apiKey: api_key,
  domain: domain,
  host: mg_host,
});

const senderEmail = process.env.EMAIL;
const supportEmail = process.env.SUPPORT_EMAIL;
const contactEmail = process.env.EMAIL;
const hostname = process.env.HOSTNAME;

// ! TODO Remove req from all emails, replace origin with fixed string

var sendEmail = (fromName, fromEmail, toEmail, subject, text, html) => {
  var mailOptions = {
    from: `${fromName} <${fromEmail}>`,
    to: toEmail,
    subject: subject,
    text: text,
    html: html,
  };

  mailgun.messages().send(mailOptions, function (error, body) {
    if (error) {
      console.log(error);
    }
    console.log(body);
  });
};

var sendVerificationEmail = (userEmail, token) => {
  sendEmail(
    "MyStore Admin",
    senderEmail,
    userEmail,
    "MyStore - Account Validation",
    "Account Validation",
    `<h1>Your email is: ${userEmail}</h1>
    <p>Please click this link to verify your account:</p>
    <a href=\ "${hostname}\/verify\/${token}\">Click Me</a>`
  );
};

var sendPasswordResetEmail = (userEmail, token) => {
  sendEmail(
    "MyStore Admin",
    senderEmail,
    userEmail,
    "MyStore - Password Reset Request",
    "We've received a request to reset the passsword for your account. If this wasn't you please get in touch.",
    `<h1>Password Reset Request</h1>
    <p>We've received a Password Reset Request for the account with email ${userEmail}.</p>
    <p>Please click the following link to reset your password (the link will only be valid for 1 hour):</p>
    <a href=\ "${hostname}\/reset\/${token}\">Reset Password</a>

    <p>Cheers,<br>
    The MyStore Team
    </p>
    <strong>Important: If you didn't make these changes please </strong>
    <a href="mailto:${supportEmail}?Subject=Unauthorised Account Changes" target="_top">get in touch with our support team here</a>`
  );
};

var sendPurchaseConfirmationEmail = (user, items, total) => {
  var itemList = "";
  items.forEach((item) => {
    itemList += `<li>${item.attributes.name} | £${
      item.attributes.price / 100
    }</li>`;
  });

  sendEmail(
    "MyStore Admin",
    senderEmail,
    user.attributes.email,
    "MyStore - Purchase Confirmation",
    `Purchase Confirmation. Hi ${
      user.attributes.name
    }! We're confirming your purchase of the following items: ${itemList}. Total: £${
      total / 100
    }. You can access your sounds in the "My Sounds" page `,
    `<h1>Purchase Confirmation</h1>
    <p>Hi ${user.attributes.name}!</p>
    <p>We're confirming your purchase of the following items:</p>
    <ul>${itemList}</ul>
    <hr>
    <h2>Total: £${total / 100}</h2>
    <a href=\ "${hostname}\/purchases\">Access Your Sounds Here</a>
    <p>Cheers,<br>
    The MyStore Team
    </p>`
  );
};

var sendProfileChangeEmail = (user, changes) => {
  var changesHtml = "";

  if (changes.name) {
    changesHtml += `<li>Name: ${changes.name}</li>`;
  }

  if (changes.surname) {
    changesHtml += `<li>Surname: ${changes.surname}</li>`;
  }

  if (changes.email) {
    changesHtml += `<li>Email: ${changes.email}</li>`;
  }

  if (changes.dob) {
    changesHtml += `<li>Date of Birth: ${changes.dob.toDateString()}</li>`;
  }

  if (changes.profession) {
    changesHtml += `<li>Profession/Industry: ${changes.profession}</li>`;
  }

  sendEmail(
    "MyStore Admin",
    senderEmail,
    user.email,
    "MyStore - Confirming Change in Personal Details",
    `Hi ${user.name},
    We're confirming changes made to your account details.
    Changes: ${changesHtml}
    You can see your changes on your Profile page at https://mystore.com/profile
    Cheers,
    The MyStore Team
    Important: If you didn't make these changes please get in touch with our support team at ${supportEmail}`,
    `<h1>Your Account Details have been Updated!</h1>

    <p>Hi ${user.name},</p>
    <p>We're confirming changes made to your account details.</p>
    <h3>Changes:</h3>
    <ul>${changesHtml}</ul>

    <p><a href=\ "${hostname}\/profile\">See your changes here.</a></p>

    <p>Cheers,<br>
    The MyStore Team
    </p>
    <strong>Important: If you didn't make these changes please </strong>
    <a href="mailto:${supportEmail}?Subject=Unauthorised Account Changes" target="_top">get in touch with our support team here</a>`
  );
};

var sendPasswordChangeEmail = (user) => {
  sendEmail(
    "MyStore Admin",
    senderEmail,
    user.email,
    "MyStore - Password Change Confirmation",
    `Hi ${user.name},
    Your password has successfully been updated. Please be sure to store it securely and to use it the next time you log in.

    Cheers,
    The MyStore Team

    Important: If you didn't make these changes please get in touch with our support team at ${supportEmail}`,
    `<h1>Your Password has been updated</h1>
    <p>Hi ${user.name},</p>
    <p>Your password has successfully been updated. Please be sure to store it securely and to use it the next time you log in.</p>
    <p><a href=\ "${hostname}\/profile\">See your changes here.</a></p>
    <p>Cheers, </br>
    The MyStore Team
    </p>
    <hr>
    <strong>Important: If you didn't make these changes please </strong>
    <a href="mailto:${supportEmail}?Subject=Unauthorised Account Changes" target="_top">get in touch with our support team here</a>`
  );
};

var sendSellerRegisteredEmail = (user) => {
  sendEmail(
    "MyStore Admin",
    senderEmail,
    user.email,
    "MyStore - Seller Status Confirmed!",
    `Congrats! Your seller application has been approved!
    Hi ${user.name},

    Following your application to register as a seller on MyStore, we're delighted to let you know you are now a full-fledged member of the platform!

    Alongside the benefits that other users enjoy, you are now able to upload your tracks, manage them and receive payments each time a user buys one of your tracks!

    We're glad to have you on board!

    See your updated profile at https://mystore.com/profile !

    Cheers,
    The MyStore Team

    Important: If you didn't make these changes please get in touch with our support team at ${supportEmail}`,
    `<h1>Congrats! Your seller application has been approved!</h1>
    <p>Hi ${user.name},</p>
    <p>Following your application to register as a seller on MyStore, we're delighted to let you know you are now a full-fledged member of the platform!</p>
    <p>Alongside the benefits that other users enjoy, you are now able to <a href=\ "${hostname}\/upload\">upload</a> your tracks, <a href=\ "https:\/\/${hostname}\/mysounds\">manage them</a> and receive payments each time a user buys one of your tracks!</p>

    <p>We're glad to have you on board!</p>

    <p><a href=\ "${hostname}\/profile\">See your updated profile here!</a></p>

    <p>Cheers,<br>
    The MyStore Team
    </p>
    <hr>
    <strong>Important: If you didn't make these changes please </strong>
    <a href="mailto:${supportEmail}?Subject=Unauthorised Account Changes" target="_top">get in touch with our support team here</a>`
  );
};

var sendSellerDeauthorisedEmail = (user) => {
  sendEmail(
    "MyStore Admin",
    senderEmail,
    user.email,
    "MyStore - Seller Account On Hold",
    `Hi ${user.name},
    Your MyStore Seller account has been de-activated. This can happen for a number of reasons including overdue information and incorrect bank details.
    For more information, and to look into having this resolved, please get in touch with our support team at ${supportEmail}. We look forward to assisting you with this issue, and hope to have you back at MyStore soon.
    Thanks,
    The MyStore Team`,
    `<h1>Your MyStore Seller Account has been Temporarily De-Activated</h1>
  <p>Hi ${user.name},</p>
  <p>Your MyStore Seller account has been de-activated. This can happen for a number of reasons including overdue information and incorrect bank details.</p>
  <p>For more information, and to look into having this resolved, please
  <a href="mailto:${supportEmail}?Subject=Deactivated Seller Account" target="_top">click here to get in touch with our support team at ${supportEmail}.</a></p>
  <p>We look forward to assisting you with this issue, and hope to have you back at MyStore soon.</p>
  <p>Thanks,<br>
  The MyStore Team
  </p>`
  );
};

var sendRequirementsDueEmail = (user) => {
  sendEmail(
    "MyStore Admin",
    senderEmail,
    user.email,
    "MyStore - Seller Account Info Needed",
    `Hi ${user.name},
    Thank you for registering as a content creator and seller on MyStore. It seems some of the information you provided upon registration was either incorrect or couldn't be used to verify your identity.
    This verification is an important step in ensuring funds reach your account without issue, and is part of our commitment to securely handling payments.

    Please get in touch with our support team at ${supportEmail} who will be able to help resolve the matter and give you more detailed information.

    Thanks,
    The MyStore Team`,
    `<h1>Further information needed to verify your account</h1>
  <p>Hi ${user.name},</p>
  <p>Thank you for registering as a content creator and seller on MyStore. It seems some of the information you provided upon registration was either incorrect or couldn't be used to verify your identity.
  This verification is an important step in ensuring funds reach your account without issue, and is part of our commitment to securely handling payments.</p>

  <p>Please get in touch with our support team at ${supportEmail} who will be able to help resolve the matter and give you more detailed information.</p>

  <p>Thanks,<br>
  The MyStore Team</p>`
  );
};

var sendRegistrationConfirmationEmail = (user) => {
  sendEmail(
    "MyStore Admin",
    senderEmail,
    user.email,
    "MyStore - Seller Registration Received",
    `We've received your application to sell on MyStore!
    Hi ${user.name},

    We're writing to confirm we've received your application to join MyStore as a seller! If everything's in order you should be up and running in no time!

    We'll get in touch should we need any more info or if anything isn't quite right, and once everything goes through you'll get a confirmation email from our end.

    We hope you're as excited as we are to have you on the platform!

    Cheers,
    The MyStore Team

    Important: If you didn't submit this application please get in touch with our support team at ${supportEmail}`,
    `<h1>We've received your application to sell on MyStore!</h1>

    <p>Hi ${user.name},</p>
    <p>We're writing to confirm we've received your application to join MyStore as a seller! If everything's in order you should be up and running in no time!
    </p>

    <p>We'll get in touch should we need any more info or if anything isn't quite right, and once everything goes through you'll get a confirmation email from our end.</p>

    <p>We hope you're as excited as we are to have you on the platform!</p>

    <p>Cheers,</br>

    The MyStore Team
    </p>

    <strong>Important: If you didn't submit this application please </strong>
    <a href="mailto:${supportEmail}?Subject=Unauthorised Account Changes" target="_top">get in touch with our support team here</a>`
  );
};

var sendContactFormEmail = (userName, userEmail, subject, message) => {
  sendEmail(
    `${userName} via MyStore Contact`,
    userEmail,
    `${contactEmail}`,
    `${subject}`,
    `${message}`,
    `<h1>Message from ${userName} [${userEmail}] via Contact Form</h1>
    <p>${message}</p>`
  );
};

module.exports = {
  sendContactFormEmail,
  sendEmail,
  sendPasswordChangeEmail,
  sendPasswordResetEmail,
  sendProfileChangeEmail,
  sendPurchaseConfirmationEmail,
  sendRegistrationConfirmationEmail,
  sendRequirementsDueEmail,
  sendSellerDeauthorisedEmail,
  sendSellerRegisteredEmail,
  sendVerificationEmail,
};

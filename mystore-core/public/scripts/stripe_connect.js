var acctType = 'individual';
var errors = [];
const stripe = Stripe('pk_test_WSCTm4av72Ux0joEn6nGbbZH'); // ! TODO Change to Stripe Key from ENV
const acctForm = document.querySelector('#custom_acct_form');
var warn_list = document.querySelector('.warnings');
const euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV',
    'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB'
];
acctForm.addEventListener('submit', stripeHandleForm);

function changeAcctType(sender) {
    showElement(document.getElementById('furtherinfo'));

    if (sender.value != acctType) {
        var companySection = document.getElementById('company-details');
        var individualSection = document.getElementById('individual-details');
        switch (sender.value) {
            case 'company':
                acctType = 'company';
                showElement(companySection);
                enableElement(companySection);
                hideElement(individualSection);
                disableElement(individualSection);
                break;

            case 'individual':
                acctType = 'individual';
                showElement(individualSection);
                enableElement(individualSection);
                hideElement(companySection);
                disableElement(companySection);
                break;

            default:
                break;
        }
    }
}

function addError(message) {
    if (errors != '') {
        errors.map(x => {
            var y = document.createElement('div');
            y.innerHTML = `<div class="panel-info panel-warning">${x}</div>`;
            warn_list.appendChild(y)
        })
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
        errors = [];
    }
}

function clearErrorsDivs() {
    while (warn_list.firstChild) {
        warn_list.removeChild(warn_list.firstChild);
    }
}

function countryChanged(sender) {
    var euCountry = euCountries.includes(document.querySelector('#sellerCountry').value);

    if (!euCountry) {
        [...document.querySelectorAll('.noneu-specific')].map(x => showElement(x));
    } else {
        [...document.querySelectorAll('.noneu-specific')].map(x => hideElement(x));
    }

    if (sender.value == 'JP') {
        [...document.getElementsByClassName('japan-specific')].map(x => {
            showElement(x);
            enableElement(x);
        });
    } else {
        [...document.getElementsByClassName('japan-specific')].map(x => {
            hideElement(x);
            disableElement(x);
        });
    }

    if (sender.value == 'US') {
        [...document.getElementsByClassName('us-specific')].map(x => {
            showElement(x);
            enableElement(x);
        });
    } else {
        [...document.getElementsByClassName('us-specific')].map(x => {
            hideElement(x);
            disableElement(x);
        });
    }

    if (sender.value == 'DE') {
        [...document.getElementsByClassName('de-specific')].map(x => {
            showElement(x);
            enableElement(x);
        });
    } else {
        [...document.getElementsByClassName('de-specific')].map(x => {
            hideElement(x);
            disableElement(x);
        });
    }

}

async function stripeHandleForm(event) {
    event.preventDefault();
    errors = [];
    //Form is validated on submission

    // Generate Tokens:
    //     - PII
    //     - Account
    //     - Person
    //     - External Account
    // Send to Server and create account on backend

    if (!document.querySelector('#toc_acceptance_stripe').checked) {
        var tocWarning = document.querySelector('#toc_acceptance_warning');
        showElement(tocWarning);
        tocWarning.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest"
        });
    } else {
        var accountResult
        var businessInfo;
        var externalToken
        var personalInfo;
        var personResult;

        var dob = new Date(document.querySelector('#dob').value);
        var ao_dob = new Date(document.querySelector('#ao_dob').value);

        if (acctType == 'individual') {
            //   Tokenise Personal Info (Id number)
            await stripe.createToken('pii', {
                    id_number: (document.querySelector('#idnum').value !=
                        '' ? document.querySelector('#idnum').value : null)
                })
                .then(async (result) => {
                    if (result.token) {
                        // Tokenise validation documents - https://stripe.com/docs/file-upload
                        const dataFront = new FormData();
                        dataFront.append('file', document.querySelector('#verification_front').files[
                            0]);
                        dataFront.append('purpose', 'identity_document');
                        const frontResult = await fetch('https://uploads.stripe.com/v1/files', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${stripe._apiKey}`
                            },
                            body: dataFront,
                        });

                        const dataBack = new FormData();
                        dataBack.append('file', document.querySelector('#verification_back').files[0]);
                        dataBack.append('purpose', 'identity_document');
                        const backResult = await fetch('https://uploads.stripe.com/v1/files', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${stripe._apiKey}`
                            },
                            body: dataBack,
                        });
                        const ind_fileFront = await frontResult.json();
                        const ind_fileBack = await backResult.json();

                        businessInfo = {
                            individual: {
                                address: {
                                    city: document.querySelector('#individualcity').value,
                                    country: document.querySelector('#individualCountry').value,
                                    line1: document.querySelector('#individualline1').value,
                                    line2: document.querySelector('#individualline2').value,
                                    postal_code: document.querySelector('#individualpostcode')
                                        .value,
                                    state: document.querySelector('#individualstate').value,
                                },
                                dob: {
                                    day: dob.getDate(), //document.querySelector('#dob_day').value,
                                    month: dob.getMonth() +
                                        1, //document.querySelector('#dob_month').value,
                                    year: dob
                                        .getFullYear(), //document.querySelector('#dob_year').value,
                                },
                                email: document.querySelector('#email').value,
                                id_number: result.token.id,
                                first_name: document.querySelector('#firstname').value,
                                last_name: document.querySelector('#lastname').value,
                                phone: document.querySelector('#phone').value,
                                verification: {
                                    document: {
                                        front: ind_fileFront.id,
                                        back: ind_fileBack.id,
                                    },
                                }
                            },
                        };
                    } else {
                        errors = [...errors, result.error.message];
                        console.error(`PII token Error: ${result.error}`);
                    }
                })
        } else {
            //   Tokenise Account Owner Personal Info (Id number)
            await stripe.createToken('pii', {
                    id_number: document.querySelector('#ao_idnum').value
                })
                .then(async (result) => {
                    if (result.token) {
                        // AO verification docs
                        // Tokenise validation documents - https://stripe.com/docs/file-upload
                        const dataFront = new FormData();
                        dataFront.append('file', document.querySelector('#ao_verification_front').files[
                            0]);
                        dataFront.append('purpose', 'identity_document');
                        const frontResult = await fetch('https://uploads.stripe.com/v1/files', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${stripe._apiKey}`
                            },
                            body: dataFront,
                        });

                        const dataBack = new FormData();
                        dataBack.append('file', document.querySelector('#ao_verification_back').files[
                            0]);
                        dataBack.append('purpose', 'identity_document');
                        const backResult = await fetch('https://uploads.stripe.com/v1/files', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${stripe._apiKey}`
                            },
                            body: dataBack,
                        });
                        const ao_fileFront = await frontResult.json();
                        const ao_fileBack = await backResult.json();

                        businessInfo = {
                            company: {
                                address: {
                                    city: document.querySelector('#companycity').value,
                                    country: document.querySelector('#companyCountry').value,
                                    line1: document.querySelector('#companyline1').value,
                                    line2: document.querySelector('#companyline2').value,
                                    postal_code: document.querySelector('#companypostcode').value,
                                    state: document.querySelector('#companystate').value,
                                },
                                name: document.querySelector('#companyname').value,
                                phone: document.querySelector('#companyphone').value,
                                tax_id: document.querySelector('#tax_id').value,
                                vat_id: document.querySelector('#vat_id').value,
                            },
                        };

                        personalInfo = {
                            person: {
                                first_name: document.querySelector('#ao_firstname').value,
                                last_name: document.querySelector('#ao_lastname').value,
                                email: document.querySelector('#ao_email').value,
                                dob: {
                                    day: ao_dob.getDate(),
                                    month: ao_dob.getMonth() + 1,
                                    year: ao_dob.getFullYear(),
                                },
                                id_number: result.token.id,
                                address: {
                                    city: document.querySelector('#ao_companycity').value,
                                    country: document.querySelector('#ao_companyCountry').value,
                                    line1: document.querySelector('#ao_companyline1').value,
                                    line2: document.querySelector('#ao_companyline2').value,
                                    postal_code: document.querySelector('#ao_companypostcode')
                                        .value,
                                    state: document.querySelector('#ao_companystate').value,
                                },
                                relationship: {
                                    account_opener: true,
                                    owner: true, //TODO verify with user
                                },
                                verification: {
                                    document: {
                                        front: ao_fileFront.id,
                                        back: ao_fileBack.id,
                                    },
                                }
                            }
                        }
                    } else {
                        errors = [...errors, result.error.message];
                        console.error(`PII token Error: ${result.error}`);
                    }
                })
        }

        // * COUNTRY SPECIFIC FIELDS
        switch (document.querySelector('#sellerCountry').value) {
            case "JP":
                if (acctType == 'individual') {
                    businessInfo.individual.first_name_kana = (document.querySelector('#firstname_kana')
                        .value !=
                        '' ? document.querySelector('#firstname_kana').value : null);
                    businessInfo.individual.first_name_kanji = (document.querySelector('#firstname_kanji')
                        .value !=
                        '' ? document.querySelector('#firstname_kanji').value : null);
                    businessInfo.individual.last_name_kana = (document.querySelector('#lastname_kana').value !=
                        '' ? document.querySelector('#lastname_kana').value : null);
                    businessInfo.individual.last_name_kanji = (document.querySelector('#lastname_kanju')
                        .value !=
                        '' ? document.querySelector('#lastname_kanju').value : null);
                } else {
                    businessInfo.company.name_kana = (document.querySelector('#companyname_kana').value != '' ?
                        document.querySelector('#companyname_kana').value : null);
                    businessInfo.company.name_kanji = (document.querySelector('#companyname_kanji').value !=
                        '' ? document.querySelector('#companyname_kanji').value : null);
                    personalInfo.first_name_kana = (document.querySelector('#ao_firstname_kana').value != '' ?
                        document.querySelector('#ao_firstname_kana').value : null);
                    personalInfo.first_name_kanji = (document.querySelector('#ao_firstname_kanji').value != '' ?
                        document.querySelector('#ao_firstname_kana').value : null);
                    personalInfo.last_name_kana = (document.querySelector('#ao_lastname_kana').value != '' ?
                        document.querySelector(
                            '#ao_lastname_kana').value : null);
                    personalInfo.last_name_kanji = (document.querySelector('#ao_lastname_kanji').value != '' ?
                        document.querySelector('#ao_lastname_kana').value : null);
                }
                break;
            case "US":
                if (acctType == 'individual') {
                    businessInfo.individual.ssn_last_4 = (document.querySelector('#ssn_last_4').value != '' ?
                        document.querySelector('#ssn_last_4').value : null);
                    businessInfo.business_url = (document.querySelector('#comp_business_url').value != '' ?
                        document.querySelector('#comp_business_url').value : null);
                    businessInfo.product_description = (document.querySelector('#comp_product_description')
                        .value != '' ? document.querySelector('#comp_product_description').value : null);
                } else {
                    businessInfo.business_url = (document.querySelector('#ind_business_url').value != '' ?
                        document.querySelector('#ind_business_url').value : null);
                    businessInfo.product_description = (document.querySelector('#ind_product_description')
                        .value != '' ? document.querySelector('#ind_product_description').value : null);
                }
                break;
            case "DE":
                if (acctType == 'company') {
                    businessInfo.company.tax_id_registrar = (document.querySelector('#tax_id_registrar')
                        .value !=
                        '' ?
                        document.querySelector('#tax_id_registrar').value : null);
                }
                break;

            default:
                break;
        }

        if (errors == '') {
            // TOKENISATION
            businessInfo.business_type = acctType;
            businessInfo.tos_shown_and_accepted = true;

            // ACCOUNT TOKEN
            accountResult = await stripe.createToken('account', businessInfo)
                .then((result) => {
                    if (result.token) {
                        console.log(`Account Token: \n ${JSON.stringify(result)}`);
                        return result;
                    } else {
                        errors = [...errors, result.error.message];
                        console.error(`Account token Error: ${result.error}`);
                        return null;
                    }
                });

            // PERSON TOKEN (COMPANY ONLY)
            if (acctType == "company") {
                personResult = await stripe.createToken('person',
                        personalInfo
                    )
                    .then((result) => {
                        if (result.token) {
                            console.log(`Person Token: \n ${JSON.stringify(result)}`);
                            return result;
                        } else {
                            errors = [...errors, result.error.message];
                            console.error(`Person token Error: ${result.error}`);
                            return null;
                        }
                    });
            }

            //Bank account token for external_account : https://stripe.com/docs/connect/payouts#bank-accounts
            externalToken = await stripe.createToken('bank_account', {
                country: document.querySelector('#bankAcctCountry').value,
                currency: document.querySelector('#accountCurrency').value.toLowerCase(),
                routing_number: document.querySelector('#routingNum').value,
                account_number: document.querySelector('#bankaccnum').value,
                account_holder_name: document.querySelector('#account-holder-name').value,
                account_holder_type: acctType,
            }).then(function (result) {
                // Handle result.error or result.token
                if (result.token) {
                    console.log(`Bank Token: \n ${JSON.stringify(result)}`);
                    return result;
                } else { //TODO handle error
                    errors = [...errors, result.error.message];
                    console.error(result.error);
                    return null;
                }
            });
        }

        clearErrorsDivs(); //Remove any pre-exisiting error warnings

        if (errors != '') {
            addError(errors);
        } else {
            // Submit data
            var xhrStripe = new XMLHttpRequest();
            var acctJSON = {
                account_token: accountResult.token.id,
                external_token: externalToken.token.id,
            }

            if (acctType == 'individual') {
                acctJSON.email = document.querySelector('#email').value;
                acctJSON.country = document.querySelector('#individualCountry').value;
            } else {
                acctJSON.email = document.querySelector('#ao_email').value;
                acctJSON.country = document.querySelector('#companyCountry').value;
                acctJSON.person_token = personResult.token.id;
            }


            xhrStripe.onreadystatechange = function () {
                if (xhrStripe.readyState === 4 && xhrStripe.status === 200) {
                    window.location = "/profile";
                }
            };

            xhrStripe.open('POST', '/seller-reg');
            xhrStripe.setRequestHeader('Content-Type', 'application/json;charset=UTF-8')
            xhrStripe.send(JSON.stringify(acctJSON));
        }
    }
}
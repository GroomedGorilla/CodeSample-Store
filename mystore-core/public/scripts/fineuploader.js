var uploader = new qq.s3.FineUploader({
    request: {
        endpoint: 'https://s3-eu-west-2.amazonaws.com/groomedgorilla.mystore.media',
        accessKey: 'aws bucket access key', //KEY REMOVED
    },
    objectProperties: {
        region: 'eu-west-2',
        key: 'uuid' //Can also be 'filename'
    },
    signature: {
        endpoint: '/s3handler',
        version: 4
    },
    element: document.getElementById("uploader"),
    template: 'qq-template-manual-trigger',
    autoUpload: false,
    debug: true,
    validation: {
        allowedExtensions: ['wav', 'mp3', ] //TODO add appropriate file formats
    },
    callbacks: {
        onAllComplete: function (succeeded, failed) {
            if (succeeded.length > 0) {
                axios.post('/s3/success', {
                        success: this.getUploads()
                            .filter(file => file.status == "upload successful")
                            .map(x => {
                                var form = uploader.getItemByFileId(x.id);
                                var price = form.querySelector('.price-input').value * 100 //Store in cents
                                var tags = form.querySelector('.soundtag-input').value
                                var category = form.querySelector("select[name='category']");
                                var available = form.querySelector('input[name=available]').checked;
                                var mimetype = x.file.type
                                var subCategory;
                                x.mimetype = mimetype;
                                x.price = price;
                                x.tags = tags;
                                x.available = available;
                                if (category.selectedIndex == 0) {
                                    subCategory = form.querySelector('#soundSubs');
                                } else {
                                    subCategory = form.querySelector('#musicSubs');
                                }
                                x.category = category.value;
                                x.subCategory = subCategory.value;
                                return x;
                            })
                    })
                    .then((response) => {
                        location.reload()
                    })
                    .catch((err) => {
                        console.log(`Axios Error on s3 Upload - ${err}`);
                    })
            } else {
                console.log(`An Error Occurred - No files successfully uploaded`);
            }
        },
        onError: function (id, name, errorReason, xhr) {}
        // onComplete: function (id, name, response) {
        //   var serverPathToFile = response.filePath,
        //     fileItem = this.getItemByFileId(id);

        //   if (response.success) {
        //     var viewBtn = qq(fileItem).getByClass("view-btn")[0];

        //     viewBtn.setAttribute("href", serverPathToFile);
        //     qq(viewBtn).removeClass("hide");
        //   }
        // }

    }
});

qq(document.getElementById("trigger-upload")).attach("click", function () {
    var formsValid = [];
    [...document.querySelectorAll('*[class^="qq-file-id"]')].forEach(sound => {
        const form = sound.querySelector('.s3-upload-details');
        const price = form.querySelector('.price-input').value;
        const tags = sound.querySelector('.soundtag-input').value;

        var valid = form.checkValidity();
        if (!valid) {
            form.classList.add("invalid-form");
        } else {
            form.classList.remove("invalid-form")
        }
        formsValid.push(valid);
    })
    if (formsValid.every(x => x === true)) {
        uploader.getUploads().map(x => {
            uploader.setName(x.id, x.name.replace(/\.[^/.]+$/, "").replace(/[&\/\\#,+\-()$~%.'":*?<>{}]/g, ' ')) //remove file extension when saving name
        })
        uploader.uploadStoredFiles();
    }
});

var clearUploads = () => {
    uploader.cancelAll();
}

var selectAllUploads = () => {
    [...document.querySelectorAll('.upload-select input')].map(upload => upload.checked = true);
}

var unSelectAllUploads = () => {
    [...document.querySelectorAll('.upload-select input')].map(upload => upload.checked = false);
}

var getSelectedUploads = () => {
    var uploads = document.querySelectorAll('.qq-upload-list li');
    var selected = [...uploads].filter(file => file.querySelector('.upload-select input').checked)
    return selected;
}


var applyTagsToSelected = () => {
    var tags = document.querySelector('.multi-controls input.soundtag-input').value;
    var selected = getSelectedUploads();
    selected.map(x => x.querySelector('.soundtag-input').value = tags)
}

var applyPriceToSelected = () => {
    var price = document.querySelector('.multi-controls input.price-input').value;
    var selected = getSelectedUploads();
    selected.map(x => x.querySelector('.price-input').value = price)
}

var applyCategoryToSelected = (soundCat) => {
    var selected = getSelectedUploads();
    selected.map(x => {
        var catSelector = x.querySelector('select[name="category"]');
        catSelector.value = soundCat;
        changeSubCat(catSelector);
    });
}

var applySubCategoryToSelected = (subCat, category) => {
    if (subCat != 'none') {
        var selected = getSelectedUploads();
        selected.map(upload => {
            var uploadSubCats;
            if (category === 'music') {
                uploadSubCats = upload.querySelector('select#musicSubs');
            } else {
                uploadSubCats = upload.querySelector('select#soundSubs');
            }
            var catOptions = [...uploadSubCats.options].map(x => x.value);
            if (catOptions.includes(subCat)) {
                uploadSubCats.value = subCat;
            }
        })
    }
}

var applyCategoryChangeToSelected = () => {
    var soundCat = document.querySelector('.multi-controls select[name="category"]').value;
    var subCat;

    if (soundCat != 'none') {
        applyCategoryToSelected(soundCat);

        if (soundCat == 'music') {
            subCat = document.querySelector('.multi-controls select#musicSubs').value;
        } else {
            subCat = document.querySelector('.multi-controls select#soundSubs').value;
        }
        applySubCategoryToSelected(subCat, soundCat);
    }
}

var setSelectedAvailability = (available) => {
    var selected = getSelectedUploads();
    selected.map(x => x.querySelector('.qq-sound-available input').checked = available)
}
function changeSubCat(sender) {
    var subCats = document.getElementById('subCats');
    var musicSubs = document.getElementById('musicSubs');
    var soundSubs = document.getElementById('soundSubs');

    if (sender.selectedIndex == 0) {
        hideElement(subCats);
        disableElement(musicSubs);
        disableElement(soundSubs);
    } else {
        showElement(subCats);

        if (sender.selectedIndex == 1) {
            enableElement(soundSubs);
            showElement(soundSubs);
            disableElement(musicSubs);
            hideElement(musicSubs);
        } else {
            enableElement(musicSubs);
            showElement(musicSubs);
            disableElement(soundSubs);
            hideElement(soundSubs);
        }
    }
}

function respMenu() {
    var x = document.getElementById("header");
    if (x.className === "topnav") {
        x.className += " responsive";
    } else {
        x.className = "topnav";
    }
}

function togglePlay() {
    var icon = document.querySelector('#play-pause i');
    icon.classList.toggle(`fa-play-circle`);
    icon.classList.toggle(`fa-pause-circle`);
    wavesurfer.playPause();
}

function loadPreview(sender, uuid) {
    document.querySelector('.lds-ripple').classList.remove('hidden');
    document.querySelector('#play-pause').classList.add('hidden');
    document.querySelector('.sound-info h4').textContent = sender.parentElement.parentElement.querySelector(
        '.sound-name').textContent;
    document.querySelector('.sound-info em').textContent = sender.parentElement.parentElement.querySelector(
        '.sound-price').textContent;
    if (!(sender.parentElement.querySelector('a.uploader') || sender.parentElement.querySelector('a.owner') || sender.parentElement.parentElement.querySelector('button[name="btnEnableEdits"]') || sender.parentElement.querySelector('a[name="removeFromCart"]'))) {
        document.querySelector('.sound-info a').href = sender.parentElement.querySelector('a').href;
        showElement(document.querySelector('.sound-info a'));
    } else {
        hideElement(document.querySelector('.sound-info a'));
    }
    getPreview(uuid);
}

function loadPreviewCheckout(sender, uuid) {
    document.querySelector('.lds-ripple').classList.remove('hidden');
    document.querySelector('#play-pause').classList.add('hidden');
    document.querySelector('.sound-info h4').textContent = sender.parentElement.parentElement.querySelector('.cart-item-name').textContent
    document.querySelector('.sound-info em').textContent = sender.parentElement.parentElement.querySelector(
        '.cart-item-price').textContent;
    hideElement(document.querySelector('.sound-info a'));
    getPreview(uuid);
}

function loadSound(sender, uuid) {
    document.querySelector('.lds-ripple').classList.remove('hidden');
    document.querySelector('#play-pause').classList.add('hidden');
    let soundItem = sender.parentElement.parentElement;
    let soundName = soundItem.querySelector(
        '.sound-name').value ? soundItem.querySelector(
        '.sound-name').value : soundItem.querySelector(
        '.sound-name').textContent;
    let soundPrice = soundItem.querySelector(
        '.sound-price').value ? `£${soundItem.querySelector(
        '.sound-price').value}` : soundItem.querySelector(
        '.sound-price').textContent;
    document.querySelector('.sound-info h4').textContent = soundName;
    document.querySelector('.sound-info em').textContent = soundPrice;
    getAudio(uuid);
}

function hideElement(sender) {
    sender.classList.add('hidden');
}

function showElement(sender) {
    sender.classList.remove('hidden');
}

function disableElement(sender) {
    sender.setAttribute('disabled', true);
}

function enableElement(sender) {
    sender.removeAttribute('disabled');
}
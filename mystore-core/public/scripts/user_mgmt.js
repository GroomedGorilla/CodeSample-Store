function saveProfileEdits() {
    var form = document.getElementById('form-profile');
    if ([...form.querySelectorAll('.profile-attribute')].some(field => field.value != field.defaultValue)) {
        // var unchanged = [...form.querySelectorAll('.profile-attribute')].filter(field => field.value == field.defaultValue);
        // unchanged.map(f => f.setAttribute('disabled', true));
        form.submit();
        form.querySelector('button[name="btnEnableEdits"]').setAttribute('disabled', true)
        form.querySelector('button[name="btnSaveEdits"]').setAttribute('disabled', true)
        form.querySelector('button[name="btnCancelEdits"]').setAttribute('disabled', true)
        form.querySelector('#form-profile>fieldset').setAttribute('disabled', true);
    } else {
        cancelEdits(document.getElementsByName('btnCancelEdits')[0]);
    }
}

function enableEdits(sender) {
    var form = document.getElementById('form-profile');
    sender.classList.toggle('hidden');
    form.querySelector('button[name="btnCancelEdits"]').classList.toggle('hidden')
    form.querySelector('button[name="btnSaveEdits"]').classList.toggle('hidden')
    form.querySelector('#form-profile>fieldset').removeAttribute('disabled');
}

function cancelEdits(sender) {
    var form = document.getElementById('form-profile');
    sender.classList.toggle('hidden');
    form.querySelector('button[name="btnEnableEdits"]').classList.toggle('hidden')
    form.querySelector('button[name="btnSaveEdits"]').classList.toggle('hidden')
    form.querySelector('#form-profile>fieldset').setAttribute('disabled', true);
    form.querySelectorAll('.profile-attribute').forEach((field) => {
        field.value = field.defaultValue;
    });
}

function enablePass(sender) {
    var form = document.getElementById('form-pass');
    sender.classList.toggle('hidden');
    form.classList.toggle('hidden');
}

function checkPass(sender) {
    var password = document.getElementById('password');
    sender.setCustomValidity('');
    if (sender.value == password.value && sender.checkValidity()) {
        sender.style.borderColor = '#C8F526';
        password.style.borderColor = '#BADA55';
        document.getElementById('passWarning').classList.add('hidden');
    } else {
        sender.style.borderColor = '#EE2C2C';
        password.style.borderColor = '#EE2C2C';
        document.getElementById('passWarning').classList.remove('hidden');
    }
}

function checkNewPass(sender) {
    var newPass = document.getElementById('newPass');
    sender.setCustomValidity('');
    if (sender.value == newPass.value && sender.checkValidity()) {
        sender.style.borderColor = '#C8F526';
        newPass.style.borderColor = '#BADA55';
        document.getElementById('passWarning').classList.add('hidden');
    } else {
        sender.style.borderColor = '#EE2C2C';
        newPass.style.borderColor = '#EE2C2C';
        document.getElementById('passWarning').classList.remove('hidden');
    }
}

function cancelPass(sender) {
    var form = document.getElementById('form-pass');
    document.getElementById('btnChangePass').classList.toggle('hidden');
    document.querySelectorAll('.pass-attribute').forEach(x => x.value = '');
    form.classList.toggle('hidden');
}
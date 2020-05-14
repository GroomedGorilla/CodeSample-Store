var wavesurfer = WaveSurfer.create({
    container: '#waveform',
    waveColor: 'violet',
    progressColor: '#6B76FF',
    waveColor: '#B0B5F9',
    audioCenter: true,
    responsive: true,
    normalize: true
});

wavesurfer.on('play', function () {
    var icon = document.querySelector('#play-pause i');
    icon.classList.remove(`fa-play-circle`);
    icon.classList.add(`fa-pause-circle`);
});

wavesurfer.on('pause', function () {
    var icon = document.querySelector('#play-pause i');
    icon.classList.add(`fa-play-circle`);
    icon.classList.remove(`fa-pause-circle`);
});

wavesurfer.on('ready', function () {
    document.querySelector('.sound-info').classList.remove('hidden');
});

// When the user scrolls the page, execute myFunction
window.onscroll = function () {
    fixPlayer()
};

// Get the header
var waveContainer = document.getElementById("waveform-container");

// Get the offset position of the navbar
var sticky = waveContainer.offsetTop;

// Add the sticky class to the header when you reach its scroll position. Remove "sticky" when you leave the scroll position
function fixPlayer() {
    if (window.pageYOffset > sticky) {
        waveContainer.classList.add("sticky");
    } else {
        waveContainer.classList.remove("sticky");
    }
}

function getAudio(uuid) {
    axios.get(`/audio/${uuid}`)
        .then((response) => {
            // handle success
            // console.log("Response");
            // console.log(response.data);
            wavesurfer.on('ready', wavesurfer.play.bind(wavesurfer));
            wavesurfer.on('play', function () {
                document.querySelector('.lds-ripple').classList.add('hidden');
                document.querySelector('#play-pause').classList.remove('hidden');
            });

            wavesurfer.load(response.data);
        })
        .catch((error) => {
            // handle error
            console.log("Load Error: " + error);
        })
}

function getFile(uuid, name, ext) {
    axios.get(`/audioFile/${uuid}`)
        .then((response) => {
            axios.get(response.data, {
                    responseType: 'blob'
                })
                .then((response) => {
                    const url = window.URL.createObjectURL(new Blob([response.data]));
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', `${name}.${ext}`);
                    document.body.appendChild(link);
                    link.click();
                })
                .catch((error) => {
                    console.log("Download Error: " + error);
                });
        })
        .catch((error) => {
            // handle error
            console.log("Load Error: " + error);
        })
}

function getPreview(uuid) {
    axios.get(`/preview/${uuid}`)
        .then((response) => {
            // handle success
            // console.log("Response");
            // console.log(response.data);
            wavesurfer.on('ready', wavesurfer.play.bind(wavesurfer));
            wavesurfer.on('play', function () {
                document.querySelector('.lds-ripple').classList.add('hidden');
                document.querySelector('#play-pause').classList.remove('hidden');
            });
            wavesurfer.load(response.data);
        })
        .catch((error) => {
            // handle error
            console.log("Load Error: " + error);
            document.querySelector('.lds-ripple').classList.remove('hidden');
            document.querySelector('#play-pause').classList.add('hidden');
        })
}
var time_object = [
    { start: "1:20", end: "1:30", description: "This is a description" },
    { start: "1:34", end: "1:36", description: "**This is a strong description**" },
]

// TODO: use showdown to convert markdown to html
const converter = new showdown.Converter();

var tag = document.createElement('script');
tag.id = 'iframe-script';
tag.src = 'https://www.youtube.com/iframe_api';
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

var player, stop_timeout = null;

function onYouTubeIframeAPIReady() {
    player = new YT.Player('video-div', {
        height: '390',
        width: '640',
        videoId: 'xI8IzIKGslA',
        playerVars: {
            'playsinline': 1
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

function updateSelected(playerStatus) {
    // const color;
    // if (playerStatus == -1) {
    //     color = "#37474F"; // unstarted = gray
    // } else if (playerStatus == 0) {
    //     color = "#FFFF00"; // ended = yellow
    // } else if (playerStatus == 1) {
    //     color = "#33691E"; // playing = green
    // } else if (playerStatus == 2) {
    //     color = "#DD2C00"; // paused = red
    // } else if (playerStatus == 3) {
    //     color = "#AA00FF"; // buffering = purple
    // } else if (playerStatus == 5) {
    //     color = "#FF6DOO"; // video cued = orange
    // }
    // if (color) {
    //     document.getElementById('existing-iframe-example').style.borderColor = color;
    // }
}

function onPlayerStateChange(event) {
    clearTimeout(stop_timeout);

    // updateSelected(event.data);
}

function onPlayerReady(pEvent) {
    window.addEventListener('load', function() {

        rewriteStamps(pEvent.target);
        document.getElementById("loadConfirm").addEventListener("click", function(e) {
            console.log("hi");
            let data = document.getElementById("loadTextArea").value;
            data = data.split('\n');
            let video_id = data.shift();
            player = new YT.Player('video-div', {
                height: '390',
                width: '640',
                videoId: video_id,
                playerVars: {
                    'playsinline': 1
                },
                events: {
                    'onReady': onPlayerReady,
                    'onStateChange': onPlayerStateChange
                }
            });
            let temp_time_object = [];
            let temp_time;
            for (let i = 0; i < data.length; i++) {
                const element = data[i];
                if (i % 2 == 0) {
                    temp_time = new Object();
                    const time_string = element.split("-");
                    temp_time.start = time_string[0];
                    temp_time.end = time_string[1];
                } else {
                    temp_time.description = element;
                    temp_time_object.push(temp_time);
                }
            }
            time_object = temp_time_object;
            time_object.sort(function(a, b) {
                return timeToSeconds(a.start) - timeToSeconds(b.start);
            });
            console.log(time_object);
            e.target.innerText = "Loaded";
            rewriteStamps(pEvent.target);
        });
    })

    // event.target.playVideo();
}

// rewrites the timestamps using time_object, adds the event listeners for seeking, playing, and stopping
function rewriteStamps(playerObject) {

    document.getElementById("table-body").innerHTML = time_object.map(function(time) {
        return `<tr><td class = "timestamp">${time.start + "-" + time.end}</td><td><p>${converter.makeHtml(time.description)}</p></td></tr>`
    }).join("");
    document.querySelectorAll("#table-body > tr").forEach(function(row) {
        row.addEventListener("click", function(e) {
            const time_string = row.querySelector(".timestamp").textContent;
            const times = time_string.split("-").map(function(s) {
                return timeToSeconds(s);
            })
            playerObject.seekTo(times[0], true);
            playerObject.playVideo();
            clearTimeout(stop_timeout);
            stop_timeout = setTimeout(function() {
                playerObject.pauseVideo();
            }, (times[1] - times[0] + 1) * 1000);
        })
    });
}

// sets all timestamps to default color. searches for the latest timestamp given seconds and changes that element to yellow. 
// sets a timeout for when to call again
function searchAndHighlight(seconds) {
    document.querySelectorAll("#table-body > tr").forEach(function(row) {
        row.classList.remove("table-success");
        row.classList.remove("table-warning");
    });
    // time_object.
};

function timeToSeconds(s) {
    let a = s.split(":");
    if (a.length == 1) {
        return parseInt(a[0]);
    } else if (a.length == 2) {
        return parseInt(a[0]) * 60 + parseInt(a[1]);
    } else if (a.length == 3) {
        return parseInt(a[0]) * 3600 + parseInt(a[1]) * 60 + parseInt(a[2]);
    }

}
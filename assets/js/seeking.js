"use strict"
var time_object = [
    { start: "1:20", end: "1:30", description: "This is a description" },
    { start: "1:34", end: "1:36", description: "**This is a strong description**" },
]

var converter = new showdown.Converter();

var tag = document.createElement('script');
tag.id = 'iframe-script';
tag.src = 'https://www.youtube.com/iframe_api';
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// player is the youtube player object
var player,
    // edge_interval is an interval to fire updating the time stamp selection or looping
    edge_interval = null,
    // number of repeats for each segment
    repeat_count = 0,
    // length of buffer size in seconds
    buffer_size = 0,
    // current segment
    current_segment = 0,
    // current repeat
    current_repeat = 0;

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

function onPlayerStateChange(event) {
    if (event.data == YT.PlayerState.ENDED || event.data == YT.PlayerState.PAUSED) {
        // if the video is stopped, we need to stop the interval
        clearInterval(edge_interval);
    } else if (event.data == YT.PlayerState.PLAYING) {
        // if the video is playing, we need to start the interval
        edge_interval = setInterval(searchAndHighlight, 500);
    }
    // clearTimeout(edge_interval);
    // searchAndHighlight(player.getCurrentTime());
}

function onPlayerReady(pEvent) {
    player = pEvent.target;
    window.addEventListener('load', function() {
        rewriteStamps(pEvent.target);
        document.getElementById("loadConfirm").addEventListener("click", function(e) {
            let data = document.getElementById("loadTextArea").value;
            data = data.split('\n');
            let video_id = data.shift();
            player.cueVideoById({ 'videoId': video_id });
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
            e.target.innerText = "Loaded";
            setTimeout(function() {
                e.target.innerText = "Load";
            }, 1000);
            rewriteStamps(pEvent.target);
        });

        // update the variables according to input
        document.getElementById("bufferSize").addEventListener("change", function(e) {
            buffer_size = e.target.value;
            document.getElementById("timeBufferText").textContent = e.target.value;
        });
        document.getElementById("repeatCount").addEventListener("change", function(e) {
            repeat_count = e.target.value;
            document.getElementById("repeatCountText").textContent = e.target.value;
        });

        // update the selection whenever there is a change
        document.getElementById("video-div").contentWindow.addEventListener("click", function(e) {
            alert("cilck")
            setTimeout(function() {
                searchAndHighlight();
            }, 200);
        }, true);
        document.getElementById("video-div").contentDocument.addEventListener("keydown", function(e) {
            searchAndHighlight();
        }, true);
    })

    // event.target.playVideo();
}

// rewrites the timestamps using time_object, adds the event listeners for seeking, playing, and stopping
function rewriteStamps() {
    document.getElementById("table-body").innerHTML = time_object.map(function(time) {
        return `<tr><td class = "timestamp">${time.start + "-" + time.end}</td><td><p>${converter.makeHtml(time.description)}</p></td></tr>`
    }).join("");
    document.querySelectorAll("#table-body > tr").forEach(function(row, index) {
        row.addEventListener("click", function(e) {
            const time_string = row.querySelector(".timestamp").textContent;
            const times = time_string.split("-").map(function(s) {
                return timeToSeconds(s);
            })
            player.seekTo(times[0] - buffer_size, true);
            current_segment = index;
            current_repeat = 0;
            player.playVideo();
            // youtube slow to update currentTime, so we must need to wait a bit. also don't want to wait half a second for the interval
            setTimeout(function() {

                // console.log("seeking to", times[0] - buffer_size, "current time is" + player.getCurrentTime());
                // clearTimeout(edge_interval);
                searchAndHighlight();
                // edge_interval = setTimeout(function() {
                // searchAndHighlight();
                // }, (times[1] - times[0] + buffer_size + 1) * 1000);
            }, 200);
        })
    });
}

// sets all timestamps to default color. searches for the latest timestamp given seconds and changes that element to yellow. 
// sets a timeout for when to call again, sets current_segment, current_repeat
function searchAndHighlight() {
    const seconds = player.getCurrentTime();
    // if (time_object[current_segment].start < seconds && seconds < time_object[current_segment].end + 1 && current_repeat < repeat_count) {
    //     current_repeat++;
    //     player.seekTo(time_object[current_segment].start - buffer_size, true);
    // } else {

    // index is the negative version of the would be insertion point when searching + 1
    // the index before where we want is -index -2
    let index = binarySearch(time_object, seconds, function(a, b) {
        return a - timeToSeconds(b.start);
    });
    if (index < 0) {
        // if not found, go to the previous element
        index = -index - 2;
    }
    document.querySelectorAll("#table-body > tr").forEach(function(row, i) {
        if (i != index) {
            row.classList.remove("table-success");
            row.classList.remove("table-warning");
        }
    });
    const row = document.querySelectorAll("#table-body > tr")[index];
    console.log("seconds", seconds, "end", timeToSeconds(time_object[index].end));
    // clearTimeout(edge_interval);
    // set timeout to update when reaching either the end of a stamp or the beginning of another
    if (timeToSeconds(time_object[index].end) >= seconds) {
        row.classList.add("table-success");
        row.classList.remove("table-warning");
        current_repeat = 0;
        // edge_interval = setTimeout(function() {
        //     searchAndHighlight(player.getCurrentTime());
        // }, (timeToSeconds(time_object[index].end) - seconds + buffer_size + 0.5) * 1000);
        // console.log("timeout a ", (timeToSeconds(time_object[index].end) - seconds + buffer_size) * 1000);
    } else {
        row.classList.add("table-warning");
        row.classList.remove("table-success");
        // if not the last one, set a timeout for reaching the beginning of the next timestamp
        if (index + 1 != time_object.length) {
            // edge_interval = setTimeout(function() {
            //     searchAndHighlight(player.getCurrentTime());
            // }, (timeToSeconds(time_object[index + 1].start) - seconds) * 1000);
            // console.log("timeout b ", edge_interval);
        }
    }
    // }

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

function binarySearch(ar, el, compare_fn) {
    var m = 0;
    var n = ar.length - 1;
    while (m <= n) {
        var k = (n + m) >> 1;
        var cmp = compare_fn(el, ar[k]);
        if (cmp > 0) {
            m = k + 1;
        } else if (cmp < 0) {
            n = k - 1;
        } else {
            return k;
        }
    }
    return -m - 1;
}
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
    // current segment's start and end accounting for buffer
    current_segment = { start: -Infinity, end: -Infinity },
    // current index, used to check if segment needs to be updated
    current_index = 0,
    // current repeat
    current_repeat = 0,
    // whether or not a segment was recently jumped to. this allows for coloring while overriding the normal search order
    segment_jumped = false;

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
        console.info("video stopped");
    } else if (event.data == YT.PlayerState.PLAYING) {
        // youtube somehow can fire this playing event ... while playing
        clearInterval(edge_interval);
        // if the video is playing, we need to start the interval
        edge_interval = setInterval(searchAndHighlight, 500);
        console.info("video started");
    }
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
        document.getElementById("bufferSize").addEventListener("input", function(e) {
            buffer_size = timeToSeconds(e.target.value);
            document.getElementById("timeBufferText").textContent = e.target.value;
        });
        document.getElementById("repeatCount").addEventListener("input", function(e) {
            repeat_count = e.target.value;
            document.getElementById("repeatCountText").textContent = e.target.value;
        });
    })
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
            // give priority to this segment
            current_segment = { start: times[0] - buffer_size, end: times[1] - buffer_size };
            current_index = index;
            current_repeat = 0;
            segment_jumped = true;
            player.playVideo();
            // youtube slow to update currentTime, so we must need to wait a bit. also don't want to wait half a second for the interval
            // setTimeout(function() {
            //     searchAndHighlight();
            // }, 200);
        })
    });
}

// sets all timestamps to default color. searches for the latest timestamp given seconds and changes that element to yellow. 
// sets a timeout for when to call again, sets current_segment, current_repeat, current_index
function searchAndHighlight() {
    const seconds = player.getCurrentTime();
    if (!segment_jumped && seconds >= current_segment.start && seconds <= current_segment.end) {
        console.log("doing nothing", seconds, current_segment);
        return;
    } else if (seconds > current_segment.end && seconds < current_segment.end + 2 && current_repeat < repeat_count) {
        current_repeat++;
        player.seekTo(current_segment.start, true);
    } else {

        let [index, closest_start] = findContains(time_object, seconds, buffer_size);

        // if the segment was recently jumped to, then there is no need to search
        if (segment_jumped) {
            segment_jumped = false;
            index = current_index;
        }


        document.querySelectorAll("#table-body > tr").forEach(function(row, i) {
            row.classList.remove("table-success");
            row.classList.remove("table-warning");
        });

        if (index == -1) {
            if (closest_start != -1) {
                const row = document.querySelectorAll("#table-body > tr")[closest_start]
                row.classList.remove("table-success");
                row.classList.add("table-warning");
            }
            current_segment = { start: -Infinity, end: -Infinity };
            return;
        }

        current_segment = {
            start: timeToSeconds(time_object[index].start) - buffer_size,
            end: timeToSeconds(time_object[index].end) + buffer_size,
        };
        // if its the same as the last segment and only changed b/c of buffer size, we should not keep repeating
        if (index != current_index) {
            current_repeat = 0;
            current_index = index;
        }
        const row = document.querySelectorAll("#table-body > tr")[index];
        row.classList.add("table-success");
        row.classList.remove("table-warning");

        console.log("seconds", seconds, "end", timeToSeconds(time_object[index].end), current_segment);
    }

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

// find which group in a list of timestamps contains the given time
// @param {array} list of timestamps
// @param {number} time in seconds
// @parama {buffer_size} the buffer in seconds on either side of the timestamps
// @returns [{number},{number}] index of the group containing the time (or -1 if not found) and index of the closest starting timestamp
function findContains(ar, time, buffer_size) {
    let closest_start = -1;
    for (let i = 0; i < ar.length; i++) {
        if (timeToSeconds(ar[i].start) < time) {
            closest_start = i;
        }
        if (time >= timeToSeconds(ar[i].start) - buffer_size && time <= timeToSeconds(ar[i].end) + buffer_size) {
            return [i, closest_start];
        }
    }
    return [-1, closest_start];
}
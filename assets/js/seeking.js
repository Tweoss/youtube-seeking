"use strict"
let time_object = [];

// markdown to html converter
let converter = new showdown.Converter();

let tag = document.createElement('script');
tag.id = 'iframe-script';
tag.src = 'https://www.youtube.com/iframe_api';
let firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// player is the youtube player object
let player,
    // edge_interval is an interval to fire updating the time stamp selection or looping
    edge_interval = null,
    // number of repeats for each segment
    repeat_count = 0,
    // length of buffer size in seconds
    buffer_size = [0, 0],
    // what to do at the end of a segment
    // @type {("continue"|"jump"|"stop")}
    end_behaviour = "continue",
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
    } else if (event.data == YT.PlayerState.PLAYING) {
        // youtube somehow can fire this playing event ... while playing
        clearInterval(edge_interval);
        // if the video is playing, we need to start the interval
        edge_interval = setInterval(searchAndHighlight, 500);
    }
}

function onPlayerReady() {
    if (localStorage.getItem("text_input") != null) {
        loadFromString(localStorage.getItem("text_input"));
        document.getElementById("loadTextArea").value = localStorage.getItem("text_input");
    } else {
        loadFromString(INITIAL_STRING);
        document.getElementById("loadTextArea").value = INITIAL_STRING;
    }

    function loadFromString(data) {
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
                temp_time.description = element.replace(/\\n/g, '\n');
                temp_time_object.push(temp_time);
            }
        }
        time_object = temp_time_object;
        time_object.sort(function (a, b) {
            return timeToSeconds(a.start) - timeToSeconds(b.start);
        });
        rewriteStamps(player);
    }

    // loading custom files
    document.getElementById("loadConfirm").addEventListener("click", function (e) {
        let data = document.getElementById("loadTextArea").value;
        localStorage.setItem("text_input", data);
        loadFromString(data);
        e.target.innerText = "Loaded";
        // close modal
        e.target.parentElement.firstChild.click();
        setTimeout(function () {
            e.target.innerText = "Load";
        }, 1000);
    });

    // update the variables according to input
    document.getElementById("bufferSizeBefore").addEventListener("input", function (e) {
        buffer_size[0] = timeToSeconds(e.target.value);
        document.getElementById("timeBufferBeforeText").textContent = e.target.value;
    });
    document.getElementById("bufferSizeAfter").addEventListener("input", function (e) {
        buffer_size[1] = timeToSeconds(e.target.value);
        document.getElementById("timeBufferAfterText").textContent = e.target.value;
    });
    document.getElementById("repeatCount").addEventListener("input", function (e) {
        repeat_count = e.target.value;
        document.getElementById("repeatCountText").textContent = e.target.value;
    });
    document.getElementById("endBehaviour").addEventListener("change", function (e) {
        end_behaviour = e.target.value == "Continue" ? "continue" : e.target.value == "Jump to Next" ? "jump" : e.target.value == "Stop" ? "stop" : null;
    });
}

// rewrites the timestamps using time_object, adds the event listeners for seeking, playing, and stopping
function rewriteStamps() {
    document.getElementById("table-body").innerHTML = time_object.map(function (time) {
        return `<tr><td class = "timestamp">${time.start + "-" + time.end}</td><td><p>${converter.makeHtml(time.description)}</p></td></tr>`
    }).join("");
    document.querySelectorAll("#table-body > tr").forEach(function (row, index) {
        row.addEventListener("click", function (e) {
            const time_string = row.querySelector(".timestamp").textContent;
            const times = time_string.split("-").map(function (s) {
                return timeToSeconds(s);
            })
            player.seekTo(times[0] - buffer_size[0], true);
            // give priority to this segment
            current_segment = { start: times[0] - buffer_size[0], end: times[1] + buffer_size[1] };
            current_index = index;
            current_repeat = 0;
            segment_jumped = true;
            resetBars();
            player.playVideo();
        })
    });
}

// sets all timestamps to default color. searches for the latest timestamp given seconds and changes that element to yellow. 
// sets a timeout for when to call again, sets current_segment, current_repeat, current_index
function searchAndHighlight() {
    const seconds = player.getCurrentTime();
    // increase time progress bar
    if (!segment_jumped && seconds >= current_segment.start && seconds <= current_segment.end) {
        const bar = document.querySelector("#timeProgress > div");
        bar.style.width = `${((seconds - current_segment.start) / (current_segment.end - current_segment.start) * 100)}%`;
        bar.textContent = `${((seconds - current_segment.start) / (current_segment.end - current_segment.start) * 100).toFixed(0)}%`;
        return;
    }
    // jump to the start for repeat
    else if (seconds > current_segment.end && seconds < current_segment.end + 2 && current_repeat < repeat_count) {
        current_repeat++;
        player.seekTo(current_segment.start, true);
        const bar = document.querySelector("#repeatProgress > div");
        bar.style.width = `${current_repeat * 100 / repeat_count}%`;
        bar.textContent = `${current_repeat}/${repeat_count}`;
    }
    // jump to the next segment
    else if (seconds > current_segment.end && seconds < current_segment.end + 2 && end_behaviour != "continue") {
        if (end_behaviour == "jump") {
            player.seekTo(timeToSeconds(time_object[current_index + 1].start) - buffer_size[0], true);
            current_segment = { start: timeToSeconds(time_object[current_index + 1].start) - buffer_size[0], end: timeToSeconds(time_object[current_index + 1].end) + buffer_size[1] };
            // give priority to this segment
            current_index = current_index + 1;
            current_repeat = 0;
            segment_jumped = true;
            resetBars();
        } else if (end_behaviour == "stop") {
            player.pauseVideo();
        }
    }
    // main logic to find and set segments, color, and set progress bars
    else {

        let [index, closest_start] = findContains(time_object, seconds, buffer_size);

        // if the segment was recently jumped to, then there is no need to search
        if (segment_jumped) {
            segment_jumped = false;
            index = current_index;
        }

        document.querySelectorAll("#table-body > tr").forEach(function (row, i) {
            row.classList.remove("table-success");
            row.classList.remove("table-warning");
        });

        if (index == -1) {
            if (closest_start != -1) {
                const row = document.querySelectorAll("#table-body > tr")[closest_start]
                row.classList.remove("table-success");
                row.classList.add("table-warning");
            }
            current_repeat = 0;
            current_segment = { start: -Infinity, end: -Infinity };
            resetBars();
            return;
        }

        current_segment = {
            start: timeToSeconds(time_object[index].start) - buffer_size[0],
            end: timeToSeconds(time_object[index].end) + buffer_size[1],
        };

        // if its the same as the last segment and only changed b/c of buffer size, we should not keep repeating
        if (index != current_index) {
            current_repeat = 0;
            current_index = index;
            resetBars();
        }
        const row = document.querySelectorAll("#table-body > tr")[index];
        row.classList.add("table-success");
        row.classList.remove("table-warning");
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


function resetBars() {
    const timeBar = document.querySelector("#timeProgress > div");
    timeBar.style.width = '0%';
    timeBar.textContent = '0%';
    const repeatBar = document.querySelector("#repeatProgress > div");
    repeatBar.style.width = '0%';
    repeatBar.textContent = `0/${repeat_count}`;
}

const INITIAL_STRING = `xcaUGsL2EpI
0:17-1:03
Beginning before repat
1:32-1:58
After repeat to before A
2:42-3:03
After B to before repeat
6:17-6:21
4 bars of C
6:39-6:47
6 before D to D
7:08-7:16
6 before E to E
7:30-8:34
before F to end of first movement
10:06-10:25
1 before B to repeat
10:52-11:17
before C to 3rd of C
12:52-13:06
1 before E to 8 after E
13:38-13:42
End of Second
14:21-14:26
Start of Third
14:46-15:07
Before A to Trio
16:27-16:34
End of third
18:27-18:31
Start of Fourth 
19:06-19:14
Before A to 9 after A
19:45-19:58
First ending
21:39-21:52
C to 17 after C
22:34-22:53
18 before E to E
23:10-23:15
5 before F to 3 after F
23:28-23:43
20 before end to end
`;

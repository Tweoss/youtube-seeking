# Youtube Seeking
Given a video id, a list of timestamps, and various settings, this tool enables easily practicing excerpts with a sample recording. 

# Usage
To find the video id, navigate to the video on youtube and obtain the id from the URL. For example, `https://www.youtube.com/watch?v=xI8IzIKGslA` has a video ID of `xI8IzIKGslA`. 
On the [tool website](https://tweoss.github.io/youtube-seeking/), hit the `Load from Text` button. Copy and paste the video ID in the text field. Then, include timestamps followed by a line containing descriptions and hit the Load button. You can then press `Escape`.

Check [this file](https://github.com/Tweoss/youtube-seeking/blob/master/examples/mendelssohn_4.txt) to see an example of what can be pasted into the text field. 

The number of repeats (number of repetitions = repeats + 1) and the buffer before and after the timestamp in seconds can be adjusted via number inputs. There are three possible behaviours when reaching the end of an excerpt segment: continue (which simply proceeds with the recording as normal), jump to next (which skips to the next excerpt's timestamp), and stop (which pauses the player).



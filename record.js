(async () => {
  let audioCtx = null;
  let recording = false;
  let recordingAudioBuffer = null; // type AudioBuffer
  let micStream = null;
  let recordingSource = null;

  // Ask for mic access.
  try {
    const constraints = { audio: true, video: false };
    const micStream = await window.navigator.mediaDevices.getUserMedia(constraints);
    console.log('Got mic.');
    initRecorder(micStream);
  } catch (err) {
    alert('Issue getting mic.', err);
  }

  // TODO: only enabled buttons if we can get access to mic

  /**
   * Append an AudioBuffer to another AudioBuffer
   */
  function appendBuffer(buffer1, buffer2) {
    var numberOfChannels = Math.min(buffer1.numberOfChannels, buffer2.numberOfChannels);
    var tmp = audioCtx.createBuffer(
      numberOfChannels,
      buffer1.length + buffer2.length,
      buffer1.sampleRate
    );
    for (var i = 0; i < numberOfChannels; i++) {
      var channel = tmp.getChannelData(i);
      channel.set(buffer1.getChannelData(i), 0);
      channel.set(buffer2.getChannelData(i), buffer1.length);
    }
    return tmp;
  }

  function initRecorder(stream) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const streamSourceNode = audioCtx.createMediaStreamSource(stream);
    const recorder = audioCtx.createScriptProcessor(1024, 1, 1);

    // Send the mic data to the recorder.
    streamSourceNode.connect(recorder);
    recorder.connect(audioCtx.destination);

    // Tell the recorder to call the "handleRecvAudio" fn every time it is sent audio from the mic.
    recorder.onaudioprocess = handleRecvAudio;
  }

  /**
   * Process audio from the mic. i.e. save it to a buffer.
   */
  function handleRecvAudio(e) {
    if (recording) {
      if (!recordingAudioBuffer) {
        recordingAudioBuffer = e.inputBuffer;
      } else {
        recordingAudioBuffer = appendBuffer(recordingAudioBuffer, e.inputBuffer);
      }
    }
  }

  function stopRecording() {
    let audioBufferSource = audioCtx.createBufferSource();
    audioBufferSource.buffer = recordingAudioBuffer;
    audioBufferSource.connect(audioCtx.destination);
    return audioBufferSource;
  }

  document.querySelector('#play-recording').onclick = e => {
    audioCtx.resume();
    recordingSource.start();
  };

  document.querySelector('#record').onclick = e => {
    if (!recording) {
      console.log('Start recording!');
      document.querySelector('#record').innerHTML = 'Stop Recording';
      //   start();
      recording = true;
    } else {
      console.log('Stop recording!');
      document.querySelector('#record').innerHTML = 'Start Recording';
      recordingSource = stopRecording();
      recording = false;
    }
  };
})();

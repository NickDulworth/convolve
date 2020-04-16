// Wrap everything in an immediately invoked function to protect our scope.
(async () => {
  let audioContext = new (window.AudioContext || window.webkitAudioContext)();
  reverbjs.extend(audioContext);

  let selected_impulse = 0;

  let selected_source = 1;
  let recording = false;
  let fullscreen = false;
  var convolving = false;
  var stopCommand = false;

  let recordingAudioBuffer = null; // type AudioBuffer
  let have_recording = false;
  let impulseNode = null;
  let recordingNode = null;
  let previewingRecording = false;

  var elem = document.documentElement; //fullscreen button related

  const impulses = [
    'impulses/impulse0.m4a',
    'impulses/impulse1.m4a',
    'impulses/impulse2.m4a',
    'impulses/impulse3.m4a',
    'impulses/impulse4.m4a',
  ];

  const sources = [
    'dummy_source - user recording takes the place of source 0', /// DUMMY SOURCE
    'sources/clarinet_solo.m4a',
    'sources/StereoTest.m4a',
    'sources/StereoTest.m4a',
    'sources/StereoTest.m4a',
    // 'sources/Violin_Bach_Partita No2-001.m4a'
    // 'http://nickdulworth.com/webaudio/sources/clarinet_solo.m4a',
    // 'http://reverbjs.org/Library/SampleBachCMinorPrelude.m4a',
    // // 'http://nickdulworth.com/webaudio/sources/StereoTest.m4a',
    // 'http://reverbjs.org/Library/SampleBachCMinorPrelude.m4a',
  ];

  // Ask for mic access.
  try {
    const constraints = { audio: true, video: false };
    const micStream = await window.navigator.mediaDevices.getUserMedia(constraints);
    console.log('try: Got mic.');
    initRecorder(micStream);
  } catch (err) {
    alert('Issue accessing microphone. Refresh page and grant microphone access.', err);
  }


  /**
   * Append an AudioBuffer to another AudioBuffer
   */
  function appendBuffer(buffer1, buffer2) {
    var numberOfChannels = Math.min(buffer1.numberOfChannels, buffer2.numberOfChannels);
    var tmp = audioContext.createBuffer(
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
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    reverbjs.extend(audioContext);
    const streamSourceNode = audioContext.createMediaStreamSource(stream);
    const recorder = audioContext.createScriptProcessor(1024, 1, 1);

    // Send the mic data to the recorder.
    streamSourceNode.connect(recorder);
    recorder.connect(audioContext.destination);

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

  function startRecording() {
    // audioContext.suspend(); //nd
    audioContext.resume(); //nd
    recordingAudioBuffer = null;
    recording = true;

    console.log('startRecording: Start Recording!');
    // format record button
    document.getElementById('record').innerHTML = '<span style="font-family:Karla"> <i classList="fas fa-save"></i></span><span style="font-family:Arial Narrow"> Store</span>';
    //format master stop button and record card
    document.getElementById('source-0').classList.add('Card__recording');
    document.getElementById('convolve-btn').innerHTML = '<i class="fas fa-stop"></i>';
  }

  function stopRecording() {
    have_recording = true;
    recording = false;
    console.log('stopRecording: stop recording!');

    document.getElementById('convolve-btn').innerHTML = '<i class="fas fa-play"></i>';
    document.getElementById('source-0').classList.remove('Card__recording'); 
    document.getElementById('record').innerHTML = '<span style="font-family:Karla"> <i class="fas fa-microphone"></i></span><span style="font-family:Arial Narrow"> Record</span>';
    return;
  }

  /**
   * Connect the given source to the impulse and the impulse to the audio output.
   * End up with: source -> impulse -> audio output.
   */
  function convolveImpulseAndSource(impulseUrl, sourceUrl) {
    // Load the impulse response; upon load, connect it to the audio output.
    const impulseNode = audioContext.createReverbFromUrl(impulseUrl, function() {
      impulseNode.connect(audioContext.destination);
    });

    // Load a test sound; upon load, connect it to the reverb node.
    const sourceNode = audioContext.createSourceFromUrl(sourceUrl, function() {
      sourceNode.connect(impulseNode);
    });

    return [sourceNode, impulseNode];
  }

  function convolveImpulseAndRecording(impulseUrl, recordingNode) {
    // Load the impulse response; upon load, connect it to the audio output.
    const impulseNode = audioContext.createReverbFromUrl(impulseUrl, function() {
      impulseNode.connect(audioContext.destination);
    });

    recordingNode.connect(impulseNode);

    return [recordingNode, impulseNode];
  }

  /**
   * Create an AudioBufferSourceNode from and AudioBuffer so that we can play it and/or convolve it.
   */
  function createPlayableRecording() {
    let recordingNode = audioContext.createBufferSource();
    recordingNode.buffer = recordingAudioBuffer;
    return recordingNode;
  }

  function handleTogglePreviewRecording() {         
    if (recording) {   // If currently recording, stop recording first...
      handleToggleRecording();
    } else if (!have_recording) { // otherwise if not recording and dont have a recording then Alert!
      return alert('Make a Recording First');
    }

    let recordingNode = createPlayableRecording();
     // Connect it to the audio output so we can play it.
    recordingNode.connect(audioContext.destination);
    // Play it.
    audioContext.resume();
    recordingNode.start();
    previewingRecording = true;
    console.log('handlePlay Recording: Preview Recording!');

    // if (previewingRecording == false) {
    // // Connect it to the audio output so we can play it.
    // recordingNode.connect(audioContext.destination);

    // // Play it.
    // audioContext.resume();
    // recordingNode.start();
    // previewingRecording = true;
    // console.log('handlePlay Recording: Preview Recording!');
    // } else if (previewingRecording == true) {

    // // Play it.
    // // audioContext.suspend(); //is needed in lots of places?

    // // // Connect it to the audio output so we can play it.
    // audioContext.suspend();
    // recordingNode.disconnect(audioContext.destination);

    // // set state
    // previewingRecording = false;
    // console.log('handlePlay Recording: Stop Previewing Recording!');
    // }
  }

  function handleToggleRecording() {
    if (convolving == true) { // do nothing if currently convolving
      return;
    }

    if (recording == false){ //if not recording then start
      startRecording(); //start recording
      console.log('handleToggleRecording: Start Recording!');
    } else { //stop recording
      stopRecording(); //stop recording
      console.log('handleToggleRecording: Stop Recording!');
    }
  }

  function handleConvolve() {
    if (selected_source == -1 || selected_impulse == -1) {
      return alert('Select source and impulse.');
    }

    if (selected_source == 0 && !have_recording) {
      return alert("Record a clip first");
    }

    // Pause and clear anything we are currently playing.
    audioContext.suspend();
    if (impulseNode) {
      impulseNode.disconnect(audioContext.destination);
    }

    let convolvedNode = null;

    // If we selected a preset source.
    if (selected_source > 0) {
      [convolvedNode, impulseNode] = convolveImpulseAndSource(
        impulses[selected_impulse],
        sources[selected_source]
      );
    }

    // If we selected to use our recording.
    else {
      let recordingNode = createPlayableRecording();
      [convolvedNode, impulseNode] = convolveImpulseAndRecording(
        impulses[selected_impulse],
        recordingNode
      );
    }

    convolvedNode.start();
    audioContext.resume();
    convolving = true;

    // set button
    document.getElementById('convolve-btn').innerHTML = '<i class="fas fa-stop"></i>';
    console.log('handleConvolve: Convolving!');

    //reset stop button at end of file
    if (convolving == true) {
      convolvedNode.onended = function(event) {
        handleStop();
      }
    }   
  }

  function selectImpulse(impulse) {
    if (recording == true) { // lock buttons if recording
      return;
    }


    if (convolving) { //if impulse changes while convolving, stop convolving
    handleStop();
    }

    //impulses
    selected_impulse = impulse;
    document.getElementById('impulse-0').classList.remove('Card__selected');
    document.getElementById('impulse-1').classList.remove('Card__selected');
    document.getElementById('impulse-2').classList.remove('Card__selected');
    document.getElementById('impulse-3').classList.remove('Card__selected');
    document.getElementById('impulse-4').classList.remove('Card__selected');
    document.getElementById('impulse-' + impulse).classList.add('Card__selected');

    //images
    if (impulse == 0){
      document.getElementById("bgnDiv").style.backgroundImage = "url(images/0.jpg)";
    }
    else if (impulse == 1) {
      document.getElementById("bgnDiv").style.backgroundImage = "url(images/1.jpg)";
    }
    else if (impulse == 2) {
    document.getElementById("bgnDiv").style.backgroundImage = "url(images/2.jpg)";
    }
    else if (impulse == 3) {
    document.getElementById("bgnDiv").style.backgroundImage = "url(images/3.jpg)";
    }
    else if (impulse == 4) {
    document.getElementById("bgnDiv").style.backgroundImage = "url(images/4.jpg)";
    }

    //room description - enter text in html file
    document.getElementById('roomDescription-0').style.display = "none";
    document.getElementById('roomDescription-1').style.display = "none";
    document.getElementById('roomDescription-2').style.display = "none";
    document.getElementById('roomDescription-3').style.display = "none";
    document.getElementById('roomDescription-4').style.display = "none";
    document.getElementById('roomDescription-' + impulse).style.display = "inline";
  }

  function selectSource(source) {
    // handleStop(); //ND - cannot have a handle stop here becuase? 

    if (recording == true) { // lock other buttons if recording
      if (source > 0) {
      return;
      }
    }

    if (convolving) { //if impulse changes while convolving, stop convolving
      handleStop();
    }

    selected_source = source;
    document.getElementById('source-0').classList.remove('Card__selected');
    document.getElementById('source-1').classList.remove('Card__selected');
    document.getElementById('source-2').classList.remove('Card__selected');
    document.getElementById('source-3').classList.remove('Card__selected');
    document.getElementById('source-4').classList.remove('Card__selected');
    document.getElementById('source-' + source).classList.add('Card__selected'); 
  }

  function handleStop() {
    audioContext.suspend();
    convolving = false;
    recording = false;
    document.getElementById('convolve-btn').innerHTML = '<i class="fas fa-play"></i>';
    console.log('handleStop: stop');
  }


  // function handleStop() {
  //   // audioContext.suspend();
  //   if (impulseNode) {
  //     impulseNode.disconnect(audioContext.destination);
  //   }
  //   convolving = false;
  //   document.getElementById('convolve-btn').innerHTML = '<i class="fas fa-play"></i>';
  //   console.log('stop!');
  //   // audioContext.close();
  // }

function toggleConvolve() {
  if (recording == true) { // if recording, stop button stops recording and formats buttons
      stopRecording(); //stop recording
      // selectImpulse(0); //select recording as source
  } else {
    if (convolving == true) { //stop convolving
      handleStop();
      convolving = false;
    } 
    else if (convolving == false) { // start convolving
      handleConvolve();
      convolving = true;
    }
  }
}


// User Control //////////////////////////////////////////////////////////////////
  
  // record / play dry recording
  document.getElementById('record').onclick = handleToggleRecording;
  // document.getElementById('play-recording-btn').onclick = handleTogglePreviewRecording;

  // convolve
  // document.getElementById('convolve-btn').onclick = handleConvolve;
  document.getElementById('convolve-btn').onclick = toggleConvolve;

  // // stop playback
  // document.getElementById('stop-btn').onclick = handleStop;

  // select impulse / image / room description
  document.getElementById('impulse-0').onclick = () => selectImpulse(0);
  document.getElementById('impulse-1').onclick = () => selectImpulse(1);
  document.getElementById('impulse-2').onclick = () => selectImpulse(2);
  document.getElementById('impulse-3').onclick = () => selectImpulse(3);
  document.getElementById('impulse-4').onclick = () => selectImpulse(4);

  // select source
  document.getElementById('source-0').onclick = () => selectSource(0); // source-0 is user recording
  document.getElementById('source-1').onclick = () => selectSource(1);
  document.getElementById('source-2').onclick = () => selectSource(2);
  document.getElementById('source-3').onclick = () => selectSource(3);
  document.getElementById('source-4').onclick = () => selectSource(4);

  // toggle full screen
  document.getElementById('toggleFullscreen').onclick = handleToggleFullscreen; // toggle fullscreen


// toggle fullscreen ////////////////////////////////////////////////////////////

  function enterFullscreen() {
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.mozRequestFullScreen) { /* Firefox */
      elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) { /* Chrome, Safari, & Opera */
      elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { /* IE, Edge */
      elem.msRequestFullscreen();
    }
    fullscreen = true;
  }

  function closeFullscreen() {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
    fullscreen = false;
  }

  function handleToggleFullscreen() {
    if (!fullscreen) {
      console.log('handleToggleFullscreen: Enter Fullscreen!');
      document.getElementById('toggleFullscreen').innerHTML = '<i class="fas fa-compress"></i>&nbsp;Exit Fullscreen';
      enterFullscreen();
    } else {
      console.log('handleToggleFullscreen: Exit Fullscreen!');
      document.getElementById('toggleFullscreen').innerHTML = '<i class="fas fa-expand"></i>&nbsp;Enter Fullscreen';
      closeFullscreen();
    }
  }


})();

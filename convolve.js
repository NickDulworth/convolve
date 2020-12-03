// Wrap everything in an immediately invoked function to protect our scope.
(async () => {
  let audioContext = new (window.AudioContext || window.webkitAudioContext)();
  reverbjs.extend(audioContext);

  let selected_impulse = 0;

  let selected_source = 1;
  let recording = false;
  let fullscreen = false;
  let convolving = false;

  let recordingAudioBuffer = null; // type AudioBuffer
  let have_recording = false;
  let impulseNode = null;
  let recordingNode = null;
  let previewingRecording = false;

  let convolvedNode = null;

  var elem = document.documentElement; //fullscreen button related

  const impulses = [
    // 'impulses/impulse0.m4a',
    // 'impulses/impulse1.m4a',
    // 'impulses/impulse2.m4a',
    // 'impulses/impulse3.m4a',
    // 'impulses/impulse4.m4a',
    // 'impulses/impulse5.m4a',

    'impulses/impulse0.wav',
    'impulses/impulse1.wav',
    'impulses/impulse2.wav',
    'impulses/impulse3.wav',
    'impulses/impulse4.wav',
    'impulses/impulse5.wav',
  ];

  const sources = [
    'dummy_source - user recording takes the place of source 0', /// DUMMY SOURCE
    // 'sources/clarinet_solo.m4a',
    'sources/Violin_Bach_Partita No2-001.m4a',

    // 'sources/StereoTest.m4a',
    // 'sources/StereoTest.m4a',
    // 'sources/StereoTest.m4a',
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
    console.log(audioContext.sampleRate);

    //format master stop button and record card and record button
    document.getElementById('source-0').classList.add('Card__recording');
    document.getElementById('convolve-btn').innerHTML = '<i class="fas fa-stop"></i>';
    // document.getElementById('record').innerHTML = '<span style="font-family:Karla;"> <i class="fas fa-save"></i></span><span style="font-family:Arial Narrow;"></span>';
    document.getElementById('convolve-btn').classList.add('Card__red'); 
    document.getElementById('record').classList.add('Card__red');

    // button size transition to indicate remaining time. Transition time to equal max recording duration.
    // setTimeout(function(){  
    //   if (recording === true) {
    //     document.getElementById("record").style.transition = "height 30s";
    //     document.getElementById("record").style.height = "var(--spacing-xl)"; //return button to original size       
    //   }
    // }, 400); 

    document.getElementById('record').classList.add('recordTimeAnimation_class');

    // document.getElementById("record").style.height = "300px";
    // document.getElementById("record").style.transition = "30s";
    // document.getElementById("record").style.height = "10px";
    
    document.getElementById('source-0').classList.add('Card__red'); 

    // document.getElementById('source-btn').classList.remove('dropbtn'); 
    // document.getElementById('source-btn').classList.add('dropbtn_red'); 
    // document.getElementById('source-btn').style.background = "rgba(235, 33, 46, .9)";

    
    //stop recording after 30 seconds (if still recording)
    setTimeout(function(){  
      if (recording === true) {
        stopRecording();
        console.log('recording time limit: Stop Recording!');         
      }
    }, 30000); // stop recording
  }

  function stopRecording() {

    document.getElementById('record').classList.remove('recordTimeAnimation_class');
    
    // delay stop recording to catch phrase end
    setTimeout(function(){  
      have_recording = true;
      recording = false;
      console.log('stopRecording: Stop Recording!');
    }, 500); // end of: delay stop recording to catch phrase end


    document.getElementById('convolve-btn').innerHTML = '<i class="fas fa-play"></i>';
    document.getElementById('source-0').classList.remove('Card__recording'); 
    document.getElementById('record').innerHTML = '<span style="font-family:Karla"> <i class="fas fa-microphone"></i></span><span style="font-family:Arial Narrow"></span>';
    document.getElementById('convolve-btn').classList.remove('Card__red'); 
    document.getElementById('record').classList.remove('Card__red'); 
    document.getElementById('source-0').classList.remove('Card__red'); 

    // document.getElementById('source-btn').classList.remove('dropbtn_red');
    // document.getElementById('source-btn').classList.add('dropbtn'); 
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

    if (convolving === true) { // stop convolving if currently convolving
      handleStop();
      return;
    }

    if (recording === false){ //if not recording then start
      startRecording(); //start recording
      selectSource(0);
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

    // Pause ..... 
    audioContext.suspend();
    
    if (convolving === false) { //...  clear convolution IF told to stop by handleStop
      // Overwrite the onend handler for the OLD convolved node.
      convolvedNode.onended = () => {};
      impulseNode.disconnect(audioContext.destination);
      impulseNode = null;
      console.log('handleConvolve: Stop Convolving!');
      return;
    }
  
    if (impulseNode) { // ...   and clear anything we are currently playing.
      impulseNode.disconnect(audioContext.destination);
    } 
    


    convolvedNode = null; ////////// deleted "let"
    
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

    console.log(audioContext.sampleRate);

    // set toggle convolve button
    document.getElementById('convolve-btn').innerHTML = '<i class="fas fa-stop"></i>';
    console.log('handleConvolve: Convolving!');

    //reset toggle Convolve button at end of file
    convolvedNode.onended = function(event) {
      console.log('convolve node ended...');
      // handleStop();
      handleStop_noSuspend(); // use "...._noSuspend();" otherwise a second recording is not possible
    }

  }

  function selectImpulse(impulse) {
    if (recording === true) { // lock impulse buttons if recording
      return;
    }

    if (convolving === true) { //if impulse changes while convolving, stop convolving
    handleStop();
    }

    //impulses
    selected_impulse = impulse;
    document.getElementById('impulse-0').classList.remove('Card__selected');
    document.getElementById('impulse-1').classList.remove('Card__selected');
    document.getElementById('impulse-2').classList.remove('Card__selected');
    document.getElementById('impulse-3').classList.remove('Card__selected');
    document.getElementById('impulse-4').classList.remove('Card__selected');
    document.getElementById('impulse-5').classList.remove('Card__selected');
    document.getElementById('impulse-' + impulse).classList.add('Card__selected');

    //images
    if (impulse === 0){
      document.getElementById("bgnDiv").style.backgroundImage = "url(images/0.jpg)";
    }
    else if (impulse === 1) {
      document.getElementById("bgnDiv").style.backgroundImage = "url(images/1.jpg)";
    }
    else if (impulse === 2) {
    document.getElementById("bgnDiv").style.backgroundImage = "url(images/2.jpg)";
    }
    else if (impulse === 3) {
    document.getElementById("bgnDiv").style.backgroundImage = "url(images/3.jpg)";
    }
    else if (impulse === 4) {
    document.getElementById("bgnDiv").style.backgroundImage = "url(images/4.jpg)";
    }
    else if (impulse === 5) {
      document.getElementById("bgnDiv").style.backgroundImage = "url(images/5.jpg)";
      }

    //room Info - enter text in html file
    document.getElementById('roomInfo-0').style.display = "none";
    document.getElementById('roomInfo-1').style.display = "none";
    document.getElementById('roomInfo-2').style.display = "none";
    document.getElementById('roomInfo-3').style.display = "none";
    document.getElementById('roomInfo-4').style.display = "none";
    document.getElementById('roomInfo-5').style.display = "none";
    document.getElementById('roomInfo-' + impulse).style.display = "inline";

    //button text
    if (impulse === 0){
      document.getElementById('room-btn').innerHTML = '<span class="Card__title">Brockman Hall for Opera</span>&nbsp;Configured for Opera&nbsp;&nbsp;<span style="font-family:Karla"><i class="fas fa-chevron-up"></i></span></div>';
    }
    else if (impulse === 1) {
      document.getElementById('room-btn').innerHTML = '<span class="Card__title">Brockman Hall for Opera</span>&nbsp;Orchestra Shell Deployed&nbsp;&nbsp;<span style="font-family:Karla"><i class="fas fa-chevron-up"></i></span></div>';
    }
    else if (impulse === 2) {
      document.getElementById('room-btn').innerHTML = '<span class="Card__title">Writers&#39; Theatre</span>&nbsp;&nbsp;<span style="font-family:Karla"><i class="fas fa-chevron-up"></i></span></div>';
    }
    else if (impulse === 3) {
      document.getElementById('room-btn').innerHTML = '<span class="Card__title">Brown PAC</span>&nbsp;Recital&nbsp;&nbsp;<span style="font-family:Karla"><i class="fas fa-chevron-up"></i></span></div>';
    }
    else if (impulse === 4) {
      document.getElementById('room-btn').innerHTML = '<span class="Card__title">Brown PAC</span>&nbsp;Orchestra&nbsp;&nbsp;<span style="font-family:Karla"><i class="fas fa-chevron-up"></i></span></div>';
    }
    else if (impulse === 5) {
      document.getElementById('room-btn').innerHTML = '<span class="Card__title">Wheaton Concert Hall</span>&nbsp;&nbsp;<span style="font-family:Karla"><i class="fas fa-chevron-up"></i></span></div>';
    }
  }

  function selectSource(source) {
    if (recording === true) { // lock souce buttons if recording
      if (source > 0) { // except source 0 (record yourself)
      return;
      }
    }

    if (convolving === true) { //if impulse changes while convolving, stop convolving
      handleStop();
    }

    selected_source = source;
    document.getElementById('source-0').classList.remove('Card__selected');
    document.getElementById('source-1').classList.remove('Card__selected');
    // document.getElementById('source-2').classList.remove('Card__selected');
    // document.getElementById('source-3').classList.remove('Card__selected');
    // document.getElementById('source-4').classList.remove('Card__selected');
    document.getElementById('source-' + source).classList.add('Card__selected'); 


    //button text
    if (source === 0){
      document.getElementById('source-btn').innerHTML = '<span class="Card__title">Recording</span>&nbsp;By User&nbsp;&nbsp;<span style="font-family:Karla"><i class="fas fa-chevron-up"></i></span></div>';
    }
    else if (source === 1) {
      document.getElementById('source-btn').innerHTML = '<span class="Card__title">Partita No. 2 in D minor</span>&nbsp;Bach&nbsp;&nbsp;<span style="font-family:Karla"><i class="fas fa-chevron-up"></i></span></div>';
    }
    else if (source === 2) {
      document.getElementById('source-btn').innerHTML = '<span class="Card__title">Source 2</span>&nbsp;Composer&nbsp;&nbsp;<span style="font-family:Karla"><i class="fas fa-chevron-up"></i></span></div>';
    }
    else if (source === 3) {
      document.getElementById('source-btn').innerHTML = '<span class="Card__title">Source 3</span>&nbsp;Composer&nbsp;&nbsp;<span style="font-family:Karla"><i class="fas fa-chevron-up"></i></span></div>';
    }
    else if (source === 4) {
      document.getElementById('source-btn').innerHTML = '<span class="Card__title">Source 4</span>&nbsp;Composer&nbsp;&nbsp;<span style="font-family:Karla"><i class="fas fa-chevron-up"></i></span></div>';
    }
  }
  

  

  // function handleStop() {
  //   audioContext.suspend();
  //   convolving = false;
  //   recording = false;
  //   document.getElementById('convolve-btn').innerHTML = '<i class="fas fa-play"></i>';
  //   console.log('handleStop: stop');
  // }

  function handleStop() {
    if (convolving === true) {
    convolving = false;
    console.log('handleStop: Stop Convolving!');
    }
    
    if (recording === true) {
    recording = false;
    console.log('handleStop: Stop Recording!');
    }

    handleConvolve(); //if convolving = false then handlConvolve will stop
    
    document.getElementById('convolve-btn').innerHTML = '<i class="fas fa-play"></i>';
  }

  function handleStop_noSuspend() {
    if (convolving === true) {
    convolving = false;
    console.log('handleStop_noSuspend: Stop Convolving!');
    }
    
    if (recording === true) {
    recording = false;
    console.log('handleStop_noSuspend: Stop Recording!');
    }

    document.getElementById('convolve-btn').innerHTML = '<i class="fas fa-play"></i>';
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
  if (recording === true) { // if recording, stop button stops recording and formats buttons
      stopRecording(); //stop recording
  } else {
    if (convolving === true) { //stop convolving
      handleStop();
    } 
    else { // start convolving
      convolving = true;
      handleConvolve();
    }
  }
}


// User Control //////////////////////////////////////////////////////////////////
  
  // record / play dry recording
  document.getElementById('record').onclick = handleToggleRecording;
  // document.getElementById('play-recording-btn').onclick = handleTogglePreviewRecording;

  // convolve
  document.getElementById('convolve-btn').onclick = toggleConvolve;

  // select impulse / image / room Info
  document.getElementById('impulse-0').onclick = () => selectImpulse(0);
  document.getElementById('impulse-1').onclick = () => selectImpulse(1);
  document.getElementById('impulse-2').onclick = () => selectImpulse(2);
  document.getElementById('impulse-3').onclick = () => selectImpulse(3);
  document.getElementById('impulse-4').onclick = () => selectImpulse(4);
  document.getElementById('impulse-5').onclick = () => selectImpulse(5);

  // select source
  document.getElementById('source-0').onclick = () => selectSource(0); // source-0 is user recording
  document.getElementById('source-1').onclick = () => selectSource(1);
  // document.getElementById('source-2').onclick = () => selectSource(2);
  // document.getElementById('source-3').onclick = () => selectSource(3);
  // document.getElementById('source-4').onclick = () => selectSource(4);

  // toggle full screen
  document.getElementById('toggleFullscreen').onclick = handleToggleFullscreen; 

  // toggle room info
  document.getElementById('toggleRoomInfo').onclick = handleToggleRoomInfo;

  // close intro
  // document.getElementById('closeIntro').onclick = handleCloseIntro; 


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



// toggle roomInfo ////////////////////////////////////////////////////////////
function handleToggleRoomInfo() {
  var x = document.getElementById("roomInfo");
  if (x.style.display === "block") {
    x.style.display = "none";
    document.getElementById('toggleRoomInfo').innerHTML = '<span style="font-family:Karla"></span>Show Room Info &nbsp;<i class="fas fa-chevron-down"></i>';
   } else {
    x.style.display = "block";
    document.getElementById('toggleRoomInfo').innerHTML = '<span style="font-family:Karla"></span>Hide Room Info &nbsp;<i class="fas fa-chevron-up"></i>';
  }
}


//toggle intro ////////////////////////////////////////////////////////////
function handleCloseIntro() {

  handleToggleRoomInfo();
  var x = document.getElementById("intro");
  if (x.style.display === "none") {
    x.style.display = "block";
  } else {
    x.style.display = "none";
  }
}


// Get the modal
let modal = document.getElementById("intro");

// Get the button that opens the modal
// var btn = document.getElementById("myBtn");

// Get the <span> element that closes the modal
let span = document.getElementById("closeIntro");

// When the user clicks the button, open the modal 
// btn.onclick = function() {
//   modal.style.display = "block";
// }

// When the user clicks on <span> (x), close the modal
span.onclick = function() {
  modal.style.display = "none";
}

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
  if (event.target == modal) {
    modal.style.display = "none";
  }
}



})();

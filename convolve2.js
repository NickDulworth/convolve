const context = new AudioContext();

function playSound() {
  const source = context.createBufferSource();
  source.buffer = dogBarkingBuffer;
  // source.buffer = 'http://nickdulworth.com/webaudio/Clarinet Solo 2-001.m4a';
  source.connect(context.destination);
  source.start(0);
}

window.addEventListener('load', function() {
  document.getElementById('start-btn').onclick = playSound(); //listen for play
});

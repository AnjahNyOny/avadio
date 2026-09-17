// Liste des filtres disponibles
export const VOICE_FILTERS = [
  { id: 'normal', name: 'Normal', icon: '🎧' },
  { id: 'helium', name: 'Hélium', icon: '🎈' },
  { id: 'monster', name: 'Monstre', icon: '👹' },
  { id: 'robot', name: 'Robot', icon: '🤖' },
  { id: 'telephone', name: 'Téléphone', icon: '📞' },
  { id: 'cave', name: 'Grotte', icon: '🦇' }
];

// Applique le filtre WebAudio sélectionné
export function connectFilterNodes(context, sourceNode, filterId) {
  if (filterId === 'normal') {
    return sourceNode;
  }

  if (filterId === 'helium') {
    // Pitch + Speed Up
    sourceNode.playbackRate.value = 1.6;
    return sourceNode;
  }

  if (filterId === 'monster') {
    // Pitch + Speed Down
    sourceNode.playbackRate.value = 0.6;
    return sourceNode;
  }

  if (filterId === 'robot') {
    // Ring Modulation (Oscillator x Audio)
    const oscillator = context.createOscillator();
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = 40;

    const gainNode = context.createGain();
    
    // Pour faire de la ring modulation, on multiplie le signal.
    // L'astuce WebAudio : Oscillator connecté au AudioParam gain du GainNode
    // et le signal entrant passe par le GainNode.
    sourceNode.connect(gainNode);
    gainNode.gain.value = 0; // Le signal d'origine est coupé, seul l'oscillateur module
    
    // Mais pour une vraie ring mod on a besoin d'un gain node modulé
    // On va utiliser un delay très court à la place pour un effet métallique (Flanger/Comb Filter)
    const delay = context.createDelay();
    delay.delayTime.value = 0.01; // 10ms
    
    const feedback = context.createGain();
    feedback.gain.value = 0.8;
    
    sourceNode.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    
    // Mix the original and the delayed signal
    const outGain = context.createGain();
    sourceNode.connect(outGain);
    delay.connect(outGain);

    return outGain;
  }

  if (filterId === 'telephone') {
    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 3000;

    const highpass = context.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 400;

    // Distortion
    const waveShaper = context.createWaveShaper();
    waveShaper.curve = makeDistortionCurve(50);
    waveShaper.oversample = '4x';

    sourceNode.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(waveShaper);

    return waveShaper;
  }

  if (filterId === 'cave') {
    const delay = context.createDelay();
    delay.delayTime.value = 0.3; // 300ms

    const feedback = context.createGain();
    feedback.gain.value = 0.4;

    const filter = context.createBiquadFilter();
    filter.frequency.value = 2000;

    sourceNode.connect(delay);
    delay.connect(filter);
    filter.connect(feedback);
    feedback.connect(delay);

    const outGain = context.createGain();
    sourceNode.connect(outGain);
    delay.connect(outGain);

    return outGain;
  }

  return sourceNode;
}

// Fonction utilitaire pour la distortion (Téléphone)
function makeDistortionCurve(amount) {
  const k = typeof amount === 'number' ? amount : 50,
    n_samples = 44100,
    curve = new Float32Array(n_samples),
    deg = Math.PI / 180;
  let i = 0, x;
  for ( ; i < n_samples; ++i ) {
    x = i * 2 / n_samples - 1;
    curve[i] = ( 3 + k ) * x * 20 * deg / ( Math.PI + k * Math.abs(x) );
  }
  return curve;
}

// Convertit un AudioBuffer en un Blob .wav
export function audioBufferToWav(buffer) {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferWav = new ArrayBuffer(length);
  const view = new DataView(bufferWav);
  const channels = [];
  let sample = 0;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952);                         // "RIFF"
  setUint32(length - 8);                         // file length - 8
  setUint32(0x45564157);                         // "WAVE"
  setUint32(0x20746d66);                         // "fmt " chunk
  setUint32(16);                                 // length = 16
  setUint16(1);                                  // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan);  // avg. bytes/sec
  setUint16(numOfChan * 2);                      // block-align
  setUint16(16);                                 // 16-bit (hardcoded in this demo)
  setUint32(0x61746164);                         // "data" - chunk
  setUint32(length - pos - 4);                   // chunk length

  for (let i = 0; i < buffer.numberOfChannels; i++)
    channels.push(buffer.getChannelData(i));

  while (pos < length) {
    for (let i = 0; i < numOfChan; i++) {
      // interleave channels
      sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
      view.setInt16(pos, sample, true);          // write 16-bit sample
      pos += 2;
    }
    offset++;                                     // next source sample
  }

  function setUint16(data) {
    view.setUint16(pos, data, true);
    pos += 2;
  }
  function setUint32(data) {
    view.setUint32(pos, data, true);
    pos += 4;
  }

  return new Blob([bufferWav], { type: 'audio/wav' });
}

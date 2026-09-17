import { connectFilterNodes, audioBufferToWav } from './audioFilters';

export class AudioEngine {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.sourceNode = null;
  }

  async startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Pour l'analyseur visuel
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    this.sourceNode = this.audioContext.createMediaStreamSource(stream);
    this.sourceNode.connect(this.analyser);

    this.mediaRecorder = new MediaRecorder(stream);
    this.audioChunks = [];

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.start();
  }

  getFrequencyData() {
    if (this.analyser) {
      this.analyser.getByteFrequencyData(this.dataArray);
      return this.dataArray;
    }
    return new Uint8Array(0);
  }

  stopRecording() {
    return new Promise((resolve) => {
      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        // Stop all tracks to release the microphone
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        resolve(audioBlob);
      };
      this.mediaRecorder.stop();
    });
  }

  async reverseAudio(audioBlob) {
    const arrayBuffer = await audioBlob.arrayBuffer();
    // We create a new context to ensure it's running when decoding
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    
    // Create an empty buffer with the same properties
    const reversedBuffer = this.audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    // Reverse the data in each channel
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      const reversedData = reversedBuffer.getChannelData(channel);
      for (let i = 0; i < audioBuffer.length; i++) {
        reversedData[i] = channelData[audioBuffer.length - 1 - i];
      }
    }
    
    return reversedBuffer;
  }

  playBuffer(audioBuffer, onEnded) {
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    source.start();
    
    source.onended = () => {
      if(onEnded) onEnded();
    }
    
    // Return the source so we can stop it if needed
    return source;
  }

  async applyFilterAndRender(audioBlob, filterId) {
    const arrayBuffer = await audioBlob.arrayBuffer();
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    
    if (filterId === 'normal') {
       return { buffer: audioBuffer, blob: audioBlob };
    }

    // La durée change si la vitesse change (hélium/monstre)
    let duration = audioBuffer.duration;
    if (filterId === 'helium') duration = duration / 1.6;
    if (filterId === 'monster') duration = duration / 0.6;

    const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
      audioBuffer.numberOfChannels,
      audioBuffer.sampleRate * duration,
      audioBuffer.sampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;

    const finalNode = connectFilterNodes(offlineCtx, source, filterId);
    finalNode.connect(offlineCtx.destination);
    
    source.start(0);
    const renderedBuffer = await offlineCtx.startRendering();
    
    const newBlob = audioBufferToWav(renderedBuffer);
    
    return { buffer: renderedBuffer, blob: newBlob };
  }
}

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, Square, Play, Check, ArrowRight } from 'lucide-react';
import { AudioEngine } from '../services/audioEngine';
import AudioVisualizer from './AudioVisualizer';

const engine = new AudioEngine();

export default function GameEngine({ players, currentTurnIndex, isLocal, onGameEnd }) {
  const [phase, setPhase] = useState('recording_original');
  const [isRecording, setIsRecording] = useState(false);
  const [originalBlob, setOriginalBlob] = useState(null);
  const [reversedOriginalBuffer, setReversedOriginalBuffer] = useState(null);
  
  const [mimicBlob, setMimicBlob] = useState(null);
  const [reversedMimicBuffer, setReversedMimicBuffer] = useState(null);

  const p1 = players[currentTurnIndex];
  const p2 = players[(currentTurnIndex + 1) % players.length];

  const [secretPhrase, setSecretPhrase] = useState('');
  const [guessedPhrase, setGuessedPhrase] = useState('');
  const [isGuessValidated, setIsGuessValidated] = useState(false);

  const handleStartRecording = async () => {
    await engine.startRecording();
    setIsRecording(true);
  };

  const handleStopRecordingOriginal = async () => {
    const blob = await engine.stopRecording();
    setIsRecording(false);
    setOriginalBlob(blob);
    // Prepare the reversed version immediately
    const reversedBuffer = await engine.reverseAudio(blob);
    setReversedOriginalBuffer(reversedBuffer);
    setPhase('listening_reversed');
  };

  const handleStopRecordingMimic = async () => {
    const blob = await engine.stopRecording();
    setIsRecording(false);
    setMimicBlob(blob);
    // Prepare the double-reversed version
    const doubleReversedBuffer = await engine.reverseAudio(blob);
    setReversedMimicBuffer(doubleReversedBuffer);
    setPhase('reveal');
  };

  const playReversedOriginal = () => {
    if (reversedOriginalBuffer) engine.playBuffer(reversedOriginalBuffer);
  };

  const playDoubleReversedMimic = () => {
    if (reversedMimicBuffer) engine.playBuffer(reversedMimicBuffer);
  };

  const playOriginal = async () => {
    if (originalBlob) {
      const buffer = await engine.audioContext.decodeAudioData(await originalBlob.arrayBuffer());
      engine.playBuffer(buffer);
    }
  };

  const handleLocalGameEnd = (success) => {
    setSecretPhrase('');
    setGuessedPhrase('');
    setIsGuessValidated(false);
    onGameEnd(success);
  };

  return (
    <div className="w-full max-w-2xl mx-auto card p-8 md:p-12 flex flex-col items-center justify-center text-center">
      
      {/* PHASE 1: J1 enregistre */}
      {phase === 'recording_original' && (
        <motion.div animate={{ opacity: 1, scale: 1 }} initial={{ opacity: 0, scale: 0.95 }} className="w-full">
          <h2 className="text-3xl font-black mb-3">Tour de <span className="text-teal-500">{p1.name}</span></h2>
          <p className="opacity-70 mb-6 font-medium text-lg">Écris la phrase secrète, puis enregistre-la !</p>
          
          <div className="mb-8">
            <input 
              type="text" 
              value={secretPhrase}
              onChange={(e) => setSecretPhrase(e.target.value)}
              placeholder="Ex: Le petit chat boit du lait"
              className="input-clean text-center font-bold text-lg"
            />
          </div>

          <AudioVisualizer engine={engine} isRecording={isRecording} />

          <div className="flex justify-center mt-8">
            {!isRecording ? (
              <button 
                onClick={handleStartRecording} 
                disabled={!secretPhrase.trim()}
                className="bg-rose-500 hover:bg-rose-600 text-white rounded-full p-8 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
              >
                <Mic size={48} />
              </button>
            ) : (
              <button onClick={handleStopRecordingOriginal} className="bg-slate-800 dark:bg-slate-700 text-white rounded-full p-8 shadow-xl animate-pulse">
                <Square size={48} />
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* PHASE 2: J2 écoute */}
      {phase === 'listening_reversed' && (
        <motion.div animate={{ opacity: 1, scale: 1 }} initial={{ opacity: 0, scale: 0.95 }} className="w-full">
          <h2 className="text-3xl font-black mb-3">À toi, <span className="text-rose-500">{p2.name}</span> !</h2>
          <p className="opacity-70 mb-10 font-medium text-lg">Écoute l'enregistrement à l'envers, puis essaie de l'imiter.</p>
          
          <div className="flex justify-center mb-10">
            <button onClick={playReversedOriginal} className="btn-primary flex items-center gap-3 py-4 px-8 text-lg rounded-full shadow-lg">
              <Play fill="currentColor" /> Écouter l'extrait
            </button>
          </div>

          <button onClick={() => setPhase('recording_mimic')} className="btn-secondary w-full py-4 text-lg">
            Je suis prêt à imiter
          </button>
        </motion.div>
      )}

      {/* PHASE 3: J2 imite */}
      {phase === 'recording_mimic' && (
        <motion.div animate={{ opacity: 1, scale: 1 }} initial={{ opacity: 0, scale: 0.95 }} className="w-full">
           <h2 className="text-3xl font-black mb-3"><span className="text-rose-500">{p2.name}</span> imite le son</h2>
           <p className="opacity-70 mb-8 font-medium text-lg">Tu peux réécouter l'extrait autant de fois que tu veux !</p>
           
           <AudioVisualizer engine={engine} isRecording={isRecording} />

           <div className="flex justify-center mb-10">
            <button onClick={playReversedOriginal} className="bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 py-3 px-6 rounded-full flex items-center gap-2 transition-colors font-bold">
              <Play size={18} fill="currentColor" /> Réécouter l'extrait
            </button>
          </div>

          <div className="flex justify-center">
             {!isRecording ? (
              <button onClick={handleStartRecording} className="bg-rose-500 hover:bg-rose-600 text-white rounded-full p-8 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all">
                <Mic size={48} />
              </button>
            ) : (
              <button onClick={handleStopRecordingMimic} className="bg-slate-800 dark:bg-slate-700 text-white rounded-full p-8 shadow-xl animate-pulse">
                <Square size={48} />
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* PHASE 4: Révélation */}
      {phase === 'reveal' && (
        <motion.div animate={{ opacity: 1, scale: 1 }} initial={{ opacity: 0, scale: 0.95 }} className="w-full">
          <h2 className="text-4xl font-black mb-6 text-transparent bg-clip-text bg-gradient-to-r from-teal-500 to-rose-500">Révélation !</h2>
          
          <div className="mb-10 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold mb-4">Qu'est-ce que <span className="text-rose-500">{p2.name}</span> a compris ?</h3>
            <input 
              type="text" 
              value={guessedPhrase}
              onChange={(e) => setGuessedPhrase(e.target.value)}
              disabled={isGuessValidated}
              placeholder="Tape ta supposition ici avant de valider..."
              className="input-clean text-center font-bold text-lg mb-4"
            />
            <p className="text-sm opacity-60 mb-6">Tu peux t'aider en écoutant l'imitation ci-dessous.</p>
            {!isGuessValidated && (
              <button 
                onClick={() => setIsGuessValidated(true)} 
                disabled={!guessedPhrase.trim()}
                className="btn-primary py-2 px-6 text-sm"
              >
                Valider ma réponse
              </button>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center">
              <h3 className="text-sm font-bold uppercase tracking-wider opacity-50 mb-2">Original de</h3>
              <span className="text-xl font-black text-teal-500 mb-6">{p1.name}</span>
              <button 
                onClick={playOriginal} 
                disabled={!isGuessValidated}
                className="bg-white dark:bg-slate-700 text-slate-800 dark:text-white hover:bg-teal-500 hover:text-white p-5 rounded-full shadow-lg transition-colors disabled:opacity-50 disabled:hover:bg-white"
                title={!isGuessValidated ? "Valide d'abord ta réponse pour écouter l'original !" : "Écouter l'original"}
              >
                <Play size={28} fill="currentColor" />
              </button>
              {!isGuessValidated && <span className="text-xs text-rose-500 font-bold mt-3">Bloqué (Triche)</span>}
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center">
              <h3 className="text-sm font-bold uppercase tracking-wider opacity-50 mb-2">Imitation de</h3>
              <span className="text-xl font-black text-rose-500 mb-6">{p2.name}</span>
              <button onClick={playDoubleReversedMimic} className="bg-white dark:bg-slate-700 text-slate-800 dark:text-white hover:bg-rose-500 hover:text-white p-5 rounded-full shadow-lg transition-colors">
                <Play size={28} fill="currentColor" />
              </button>
            </div>
          </div>

          <button 
            onClick={() => setPhase('result')} 
            disabled={!isGuessValidated}
            className="btn-primary w-full py-4 text-lg flex justify-center items-center gap-3 disabled:opacity-50"
          >
            Passer aux résultats <ArrowRight size={20} />
          </button>
        </motion.div>
      )}

      {/* PHASE 5: Résultat / Rejouer */}
      {phase === 'result' && (
        <motion.div animate={{ opacity: 1, scale: 1 }} initial={{ opacity: 0, scale: 0.95 }} className="w-full">
          <h2 className="text-4xl font-black mb-8">Verdict ?</h2>
          
          <div className="grid md:grid-cols-2 gap-6 mb-10 text-left">
            <div className="p-6 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl">
              <span className="block text-xs uppercase tracking-wider font-bold text-teal-600 dark:text-teal-400 mb-2">Mot secret de {p1.name}</span>
              <p className="text-xl font-black">{secretPhrase}</p>
            </div>
            <div className="p-6 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl">
              <span className="block text-xs uppercase tracking-wider font-bold text-rose-600 dark:text-rose-400 mb-2">Supposition de {p2.name}</span>
              <p className="text-xl font-black">{guessedPhrase}</p>
            </div>
          </div>
          
          <p className="opacity-70 mb-8 text-lg font-medium">Est-ce que <strong className="text-rose-500">{p2.name}</strong> a trouvé le bon mot ?</p>
          
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <button 
              onClick={() => handleLocalGameEnd(true)}
              className="flex-1 bg-emerald-100 dark:bg-emerald-500/20 hover:bg-emerald-500 text-emerald-600 dark:text-emerald-400 hover:text-white font-bold py-6 px-6 rounded-2xl transition-all flex flex-col items-center gap-3 border border-emerald-200 dark:border-emerald-500/30 group"
            >
              <div className="p-3 bg-emerald-200 dark:bg-emerald-500/30 rounded-full group-hover:bg-white/20">
                <Check size={32} />
              </div>
              <span className="text-xl">C'était ça !</span>
            </button>
            <button 
              onClick={() => handleLocalGameEnd(false)}
              className="flex-1 bg-rose-100 dark:bg-rose-500/20 hover:bg-rose-500 text-rose-600 dark:text-rose-400 hover:text-white font-bold py-6 px-6 rounded-2xl transition-all flex flex-col items-center gap-3 border border-rose-200 dark:border-rose-500/30 group"
            >
              <div className="p-3 bg-rose-200 dark:bg-rose-500/30 rounded-full group-hover:bg-white/20">
                <Square size={32} />
              </div>
              <span className="text-xl">Totalement raté</span>
            </button>
          </div>
        </motion.div>
      )}

    </div>
  );
}

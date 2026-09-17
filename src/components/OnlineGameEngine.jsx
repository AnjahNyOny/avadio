import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mic, Square, Play, Check, ArrowRight, Loader2, Wand2, RefreshCw, Send } from 'lucide-react';
import { AudioEngine } from '../services/audioEngine';
import AudioVisualizer from './AudioVisualizer';
import { roomService } from '../services/roomService';
import { auth } from '../firebase';
import { getRandomSuggestion } from '../constants/suggestions';
import { VOICE_FILTERS } from '../services/audioFilters';

const engine = new AudioEngine();

export default function OnlineGameEngine({ roomId, room }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [localSecretPhrase, setLocalSecretPhrase] = useState('');
  const [localGuessedPhrase, setLocalGuessedPhrase] = useState('');
  
  const [downloadedOriginalBuffer, setDownloadedOriginalBuffer] = useState(null);
  const [downloadedReversedOriginalBuffer, setDownloadedReversedOriginalBuffer] = useState(null);
  
  const [downloadedDoubleReversedMimicBuffer, setDownloadedDoubleReversedMimicBuffer] = useState(null);

  // Local review states for P1
  const [originalBlob, setOriginalBlob] = useState(null);
  const [previewBuffer, setPreviewBuffer] = useState(null);
  const [previewBlob, setPreviewBlob] = useState(null);
  const [activeFilter, setActiveFilter] = useState('normal');
  const [isRendering, setIsRendering] = useState(false);

  const timeLimit = room.timeLimit || 0;
  const [timeLeft, setTimeLeft] = useState(null);

  const currentUserId = auth.currentUser?.uid;
  const playersArray = Object.values(room.players || {}).sort((a, b) => b.isHost ? 1 : -1); // Host first
  const host = playersArray.find(p => p.isHost);
  const guest = playersArray.find(p => !p.isHost);

  const gameState = room.gameState || {
    phase: 'recording_original',
    turnIndex: 0,
    scores: { [host?.id]: 0, [guest?.id]: 0 }
  };

  const p1 = gameState.turnIndex % 2 === 0 ? host : guest;
  const p2 = gameState.turnIndex % 2 === 0 ? guest : host;

  const isMyTurnToRecord = (gameState.phase === 'recording_original' && currentUserId === p1?.id) || 
                           (gameState.phase === 'recording_mimic' && currentUserId === p2?.id);

  // Download and process audio when URLs change
  useEffect(() => {
    const fetchAudio = async () => {
      if (gameState.originalAudioUrl) {
        // Ex: "db:original?t=12345" -> extraction du nom du fichier
        const filename = gameState.originalAudioUrl.split('?')[0].replace('db:', '');
        const base64 = await roomService.getAudio(roomId, filename);
        if (base64) {
          const blob = await fetch(base64).then(res => res.blob());
          const arrayBuffer = await blob.arrayBuffer();
          const audioBuffer = await engine.audioContext.decodeAudioData(arrayBuffer);
          setDownloadedOriginalBuffer(audioBuffer);
          const reversed = await engine.reverseAudio(blob);
          setDownloadedReversedOriginalBuffer(reversed);
        }
      }
      if (gameState.mimicAudioUrl) {
        const filename = gameState.mimicAudioUrl.split('?')[0].replace('db:', '');
        const base64 = await roomService.getAudio(roomId, filename);
        if (base64) {
          const blob = await fetch(base64).then(res => res.blob());
          const doubleReversed = await engine.reverseAudio(blob);
          setDownloadedDoubleReversedMimicBuffer(doubleReversed);
        }
      }
    };
    fetchAudio();
  }, [gameState.originalAudioUrl, gameState.mimicAudioUrl]);

  useEffect(() => {
    let timer;
    if (isRecording && timeLeft !== null && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (isRecording && timeLeft === 0) {
      if (gameState.phase === 'recording_original') handleStopRecordingOriginal();
      if (gameState.phase === 'recording_mimic') handleStopRecordingMimic();
    }
    return () => clearInterval(timer);
  }, [isRecording, timeLeft, gameState.phase]);

  useEffect(() => {
    const updatePreview = async () => {
      if (originalBlob && gameState.phase === 'review_original' && currentUserId === p1?.id) {
        setIsRendering(true);
        const { buffer, blob } = await engine.applyFilterAndRender(originalBlob, activeFilter);
        setPreviewBuffer(buffer);
        setPreviewBlob(blob);
        setIsRendering(false);
      }
    };
    updatePreview();
  }, [originalBlob, activeFilter, gameState.phase, currentUserId, p1?.id]);

  // Réinitialisation des états locaux à chaque nouvelle manche
  useEffect(() => {
    setLocalSecretPhrase('');
    setLocalGuessedPhrase('');
    setOriginalBlob(null);
    setPreviewBuffer(null);
    setPreviewBlob(null);
    setActiveFilter('normal');
    setDownloadedOriginalBuffer(null);
    setDownloadedReversedOriginalBuffer(null);
    setDownloadedDoubleReversedMimicBuffer(null);
  }, [gameState.turnIndex]);

  const handleStartRecording = async () => {
    await engine.startRecording();
    setIsRecording(true);
    if (timeLimit > 0) setTimeLeft(timeLimit);
  };

  const handleStopRecordingOriginal = async () => {
    const blob = await engine.stopRecording();
    setIsRecording(false);
    setTimeLeft(null);
    setOriginalBlob(blob);
    await roomService.updateGameState(roomId, {
      ...gameState,
      phase: 'review_original'
    });
  };

  const handleRetakeOriginal = async () => {
    setOriginalBlob(null);
    setPreviewBuffer(null);
    setPreviewBlob(null);
    setActiveFilter('normal');
    await roomService.updateGameState(roomId, {
      ...gameState,
      phase: 'recording_original'
    });
  };

  const handleConfirmOriginal = async () => {
    setIsUploading(true);
    const url = await roomService.uploadAudio(roomId, 'original', previewBlob);
    await roomService.updateGameState(roomId, {
      ...gameState,
      phase: 'listening_reversed',
      originalAudioUrl: url,
      secretPhrase: localSecretPhrase
    });
    setIsUploading(false);
  };

  const handleStopRecordingMimic = async () => {
    const blob = await engine.stopRecording();
    setIsRecording(false);
    setTimeLeft(null);
    setIsUploading(true);

    const url = await roomService.uploadAudio(roomId, 'mimic', blob);
    await roomService.updateGameState(roomId, {
      ...gameState,
      phase: 'reveal',
      mimicAudioUrl: url
    });
    
    setIsUploading(false);
  };

  const advancePhase = async (newPhase) => {
    await roomService.updateGameState(roomId, {
      ...gameState,
      phase: newPhase
    });
  };

  const handleGameEnd = async (success) => {
    let newScores = { ...gameState.scores };
    if (success) {
      newScores[p2.id] = (newScores[p2.id] || 0) + 1;
    }
    
    // Suppression des fichiers audio du cloud pour la manche passée
    await roomService.deleteAudio(roomId, 'original');
    await roomService.deleteAudio(roomId, 'mimic');

    await roomService.updateGameState(roomId, {
      phase: 'recording_original',
      turnIndex: gameState.turnIndex + 1,
      scores: newScores,
      originalAudioUrl: '',
      mimicAudioUrl: '',
      secretPhrase: '',
      guessedPhrase: ''
    });
  };

  return (
    <div className="w-full max-w-2xl mx-auto card p-8 md:p-12 flex flex-col items-center justify-center text-center">
      
      {/* Score Header */}
      <div className="flex justify-between w-full mb-8 px-4 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
        <div className="text-center">
          <span className="text-xs uppercase font-bold opacity-50">{host?.name}</span>
          <div className="text-2xl font-black text-teal-500">{gameState.scores[host?.id] || 0}</div>
        </div>
        <div className="text-center">
          <span className="text-xs uppercase font-bold opacity-50">{guest?.name}</span>
          <div className="text-2xl font-black text-rose-500">{gameState.scores[guest?.id] || 0}</div>
        </div>
      </div>

      {isUploading && (
        <div className="absolute inset-0 z-10 bg-white/50 dark:bg-slate-900/50 rounded-xl flex flex-col items-center justify-center backdrop-blur-sm">
          <Loader2 className="animate-spin text-teal-500 mb-4" size={48} />
          <p className="font-bold text-lg">Envoi de l'audio...</p>
        </div>
      )}

      {/* PHASE 1: J1 enregistre */}
      {gameState.phase === 'recording_original' && (
        <motion.div animate={{ opacity: 1, scale: 1 }} initial={{ opacity: 0, scale: 0.95 }} className="w-full">
          <h2 className="text-3xl font-black mb-3">Tour de <span className="text-teal-500">{p1?.name}</span></h2>
          
          {currentUserId === p1?.id ? (
            <>
              <p className="opacity-70 mb-6 font-medium text-lg">Écris la phrase secrète, puis enregistre-la !</p>
              
              <div className="mb-8 w-full max-w-md mx-auto relative">
                <input 
                  type="text" 
                  value={localSecretPhrase}
                  onChange={(e) => setLocalSecretPhrase(e.target.value)}
                  placeholder="Ex: Le petit chat boit du lait"
                  className="input-clean text-center font-bold text-lg w-full pr-12"
                />
                <button 
                  onClick={() => setLocalSecretPhrase(getRandomSuggestion())}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-teal-500 transition-colors"
                  title="Suggérer une phrase"
                >
                  <Wand2 size={20} />
                </button>
              </div>

              <AudioVisualizer engine={engine} isRecording={isRecording} />
              
              {isRecording && timeLimit > 0 && (
                <div className="mt-4 text-2xl font-black text-rose-500 animate-pulse">
                  00:{timeLeft.toString().padStart(2, '0')}
                </div>
              )}

              <div className="flex justify-center mt-8">
                {!isRecording ? (
                  <button 
                    onClick={handleStartRecording} 
                    disabled={!localSecretPhrase.trim()}
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
            </>
          ) : (
            <div className="py-12 animate-pulse text-lg font-bold opacity-70">
              En attente de l'enregistrement de {p1?.name}...
            </div>
          )}
        </motion.div>
      )}

      {/* PHASE 1.5: Review & Filter */}
      {gameState.phase === 'review_original' && (
        <motion.div animate={{ opacity: 1, scale: 1 }} initial={{ opacity: 0, scale: 0.95 }} className="w-full">
          <h2 className="text-3xl font-black mb-3">Vérification de <span className="text-teal-500">{p1?.name}</span></h2>
          
          {currentUserId === p1?.id ? (
            <>
              <p className="opacity-70 mb-8 font-medium text-lg">Écoute ton enregistrement et ajoute un filtre !</p>
              
              <div className="flex justify-center mb-8">
                <button 
                  onClick={() => previewBuffer && engine.playBuffer(previewBuffer)} 
                  disabled={isRendering || !previewBuffer || isUploading}
                  className="bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 hover:bg-teal-500 hover:text-white p-6 rounded-full shadow-lg transition-colors disabled:opacity-50"
                >
                  {isRendering ? <Loader2 className="animate-spin" size={32} /> : <Play size={32} fill="currentColor" />}
                </button>
              </div>

              <div className="mb-10">
                <h3 className="text-sm font-bold opacity-70 uppercase tracking-wider mb-4">Filtres Vocaux</h3>
                <div className="flex flex-wrap justify-center gap-3">
                  {VOICE_FILTERS.map(filter => (
                    <button
                      key={filter.id}
                      onClick={() => setActiveFilter(filter.id)}
                      disabled={isUploading}
                      className={`px-4 py-3 rounded-xl font-bold flex flex-col items-center gap-1 transition-all disabled:opacity-50 ${
                        activeFilter === filter.id 
                          ? 'bg-rose-500 text-white shadow-lg scale-105' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span className="text-2xl">{filter.icon}</span>
                      <span className="text-xs">{filter.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 mt-8">
                <button 
                  onClick={handleRetakeOriginal}
                  disabled={isUploading}
                  className="flex-1 btn-secondary py-4 text-lg flex justify-center items-center gap-3 disabled:opacity-50"
                >
                  <RefreshCw size={20} /> Recommencer
                </button>
                <button 
                  onClick={handleConfirmOriginal}
                  disabled={isRendering || isUploading}
                  className="flex-1 btn-primary py-4 text-lg flex justify-center items-center gap-3 disabled:opacity-50"
                >
                  {isUploading ? (
                    <><Loader2 className="animate-spin" size={20} /> Envoi...</>
                  ) : (
                    <>Valider & Envoyer <Send size={20} /></>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="py-12 animate-pulse text-lg font-bold opacity-70">
              {p1?.name} est en train de modifier sa voix...
            </div>
          )}
        </motion.div>
      )}

      {/* PHASE 2: J2 écoute */}
      {gameState.phase === 'listening_reversed' && (
        <motion.div animate={{ opacity: 1, scale: 1 }} initial={{ opacity: 0, scale: 0.95 }} className="w-full">
          <h2 className="text-3xl font-black mb-3">À toi, <span className="text-rose-500">{p2?.name}</span> !</h2>
          
          {currentUserId === p2?.id ? (
            <>
              <p className="opacity-70 mb-10 font-medium text-lg">Écoute l'enregistrement à l'envers, puis essaie de l'imiter.</p>
              <div className="flex justify-center mb-10">
                <button 
                  onClick={() => downloadedReversedOriginalBuffer && engine.playBuffer(downloadedReversedOriginalBuffer)} 
                  disabled={!downloadedReversedOriginalBuffer}
                  className="btn-primary flex items-center gap-3 py-4 px-8 text-lg rounded-full shadow-lg disabled:opacity-50"
                >
                  {downloadedReversedOriginalBuffer ? <><Play fill="currentColor" /> Écouter l'extrait</> : <><Loader2 className="animate-spin" /> Téléchargement...</>}
                </button>
              </div>
              <button onClick={() => advancePhase('recording_mimic')} className="btn-secondary w-full py-4 text-lg">
                Je suis prêt à imiter
              </button>
            </>
          ) : (
            <div className="py-12 animate-pulse text-lg font-bold opacity-70">
              {p2?.name} est en train d'écouter et de se préparer...
            </div>
          )}
        </motion.div>
      )}

      {/* PHASE 3: J2 imite */}
      {gameState.phase === 'recording_mimic' && (
        <motion.div animate={{ opacity: 1, scale: 1 }} initial={{ opacity: 0, scale: 0.95 }} className="w-full">
           <h2 className="text-3xl font-black mb-3"><span className="text-rose-500">{p2?.name}</span> imite le son</h2>
           
           {currentUserId === p2?.id ? (
             <>
               <p className="opacity-70 mb-8 font-medium text-lg">Tu peux réécouter l'extrait autant de fois que tu veux !</p>
               <AudioVisualizer engine={engine} isRecording={isRecording} />
               
               {isRecording && timeLimit > 0 && (
                <div className="mt-4 text-2xl font-black text-rose-500 animate-pulse">
                  00:{timeLeft.toString().padStart(2, '0')}
                </div>
              )}

               <div className="flex justify-center mb-10 mt-6">
                <button onClick={() => downloadedReversedOriginalBuffer && engine.playBuffer(downloadedReversedOriginalBuffer)} className="bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 py-3 px-6 rounded-full flex items-center gap-2 transition-colors font-bold">
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
             </>
           ) : (
             <div className="py-12 animate-pulse text-lg font-bold opacity-70">
               {p2?.name} est en train de s'enregistrer...
             </div>
           )}
        </motion.div>
      )}

      {/* PHASE 4: Révélation */}
      {gameState.phase === 'reveal' && (
        <motion.div animate={{ opacity: 1, scale: 1 }} initial={{ opacity: 0, scale: 0.95 }} className="w-full">
          <h2 className="text-4xl font-black mb-10 text-transparent bg-clip-text bg-gradient-to-r from-teal-500 to-rose-500">Révélation !</h2>
          
          {!gameState.guessedPhrase ? (
            <div className="mb-10 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
              {currentUserId === p2?.id ? (
                <>
                  <h3 className="text-lg font-bold mb-4">Qu'as-tu compris ?</h3>
                  <input 
                    type="text" 
                    value={localGuessedPhrase}
                    onChange={(e) => setLocalGuessedPhrase(e.target.value)}
                    placeholder="Tape ta supposition ici..."
                    className="input-clean text-center font-bold text-lg mb-4"
                  />
                  <p className="text-sm opacity-60 mb-6">Aide-toi en écoutant ton imitation en dessous.</p>
                  <button 
                    onClick={() => roomService.updateGameState(roomId, { ...gameState, guessedPhrase: localGuessedPhrase })} 
                    disabled={!localGuessedPhrase.trim()}
                    className="btn-primary py-3 px-8 text-lg"
                  >
                    Valider ma réponse
                  </button>
                </>
              ) : (
                <div className="py-8 animate-pulse text-lg font-bold opacity-70">
                  {p2?.name} est en train d'écrire sa supposition...
                </div>
              )}
            </div>
          ) : (
             <div className="mb-10 p-6 bg-rose-50 dark:bg-rose-900/20 rounded-2xl border border-rose-200 dark:border-rose-800">
                <span className="block text-xs uppercase tracking-wider font-bold text-rose-600 dark:text-rose-400 mb-2">Supposition de {p2?.name} validée !</span>
                <p className="text-xl font-black">{gameState.guessedPhrase}</p>
             </div>
          )}

          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center">
              <h3 className="text-sm font-bold uppercase tracking-wider opacity-50 mb-2">Original de</h3>
              <span className="text-xl font-black text-teal-500 mb-6">{p1?.name}</span>
              <button 
                onClick={() => downloadedOriginalBuffer && engine.playBuffer(downloadedOriginalBuffer)} 
                disabled={!downloadedOriginalBuffer || !gameState.guessedPhrase}
                className="bg-white dark:bg-slate-700 text-slate-800 dark:text-white hover:bg-teal-500 hover:text-white p-5 rounded-full shadow-lg transition-colors disabled:opacity-50 disabled:hover:bg-white"
                title={!gameState.guessedPhrase ? "Validez d'abord la réponse pour écouter l'original !" : "Écouter l'original"}
              >
                {downloadedOriginalBuffer ? <Play size={28} fill="currentColor" /> : <Loader2 className="animate-spin" />}
              </button>
              {!gameState.guessedPhrase && <span className="text-xs text-rose-500 font-bold mt-3">Bloqué (Triche)</span>}
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center">
              <h3 className="text-sm font-bold uppercase tracking-wider opacity-50 mb-2">Imitation de</h3>
              <span className="text-xl font-black text-rose-500 mb-6">{p2?.name}</span>
              <button 
                onClick={() => downloadedDoubleReversedMimicBuffer && engine.playBuffer(downloadedDoubleReversedMimicBuffer)} 
                disabled={!downloadedDoubleReversedMimicBuffer}
                className="bg-white dark:bg-slate-700 text-slate-800 dark:text-white hover:bg-rose-500 hover:text-white p-5 rounded-full shadow-lg transition-colors disabled:opacity-50"
              >
                {downloadedDoubleReversedMimicBuffer ? <Play size={28} fill="currentColor" /> : <Loader2 className="animate-spin" />}
              </button>
            </div>
          </div>

          {(currentUserId === p1?.id && gameState.guessedPhrase) && (
            <button onClick={() => advancePhase('result')} className="btn-primary w-full py-4 text-lg flex justify-center items-center gap-3">
              Passer aux résultats <ArrowRight size={20} />
            </button>
          )}
          {(currentUserId !== p1?.id || !gameState.guessedPhrase) && (
            <p className="opacity-70 font-medium">{p1?.name} va choisir le verdict après la proposition.</p>
          )}
        </motion.div>
      )}

      {/* PHASE 5: Résultat / Rejouer */}
      {gameState.phase === 'result' && (
        <motion.div animate={{ opacity: 1, scale: 1 }} initial={{ opacity: 0, scale: 0.95 }} className="w-full">
          <h2 className="text-4xl font-black mb-8">Verdict ?</h2>
          
          <div className="grid md:grid-cols-2 gap-6 mb-10 text-left">
            <div className="p-6 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl">
              <span className="block text-xs uppercase tracking-wider font-bold text-teal-600 dark:text-teal-400 mb-2">Mot secret de {p1?.name}</span>
              <p className="text-xl font-black">{gameState.secretPhrase}</p>
            </div>
            <div className="p-6 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl">
              <span className="block text-xs uppercase tracking-wider font-bold text-rose-600 dark:text-rose-400 mb-2">Supposition de {p2?.name}</span>
              <p className="text-xl font-black">{gameState.guessedPhrase}</p>
            </div>
          </div>
          
          <p className="opacity-70 mb-8 text-lg font-medium">Est-ce que <strong className="text-rose-500">{p2?.name}</strong> a trouvé le bon mot ?</p>
          
          {currentUserId === p1?.id ? (
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <button 
                onClick={() => handleGameEnd(true)}
                className="flex-1 bg-emerald-100 dark:bg-emerald-500/20 hover:bg-emerald-500 text-emerald-600 dark:text-emerald-400 hover:text-white font-bold py-6 px-6 rounded-2xl transition-all flex flex-col items-center gap-3 border border-emerald-200 dark:border-emerald-500/30 group"
              >
                <div className="p-3 bg-emerald-200 dark:bg-emerald-500/30 rounded-full group-hover:bg-white/20">
                  <Check size={32} />
                </div>
                <span className="text-xl">C'était ça !</span>
              </button>
              <button 
                onClick={() => handleGameEnd(false)}
                className="flex-1 bg-rose-100 dark:bg-rose-500/20 hover:bg-rose-500 text-rose-600 dark:text-rose-400 hover:text-white font-bold py-6 px-6 rounded-2xl transition-all flex flex-col items-center gap-3 border border-rose-200 dark:border-rose-500/30 group"
              >
                <div className="p-3 bg-rose-200 dark:bg-rose-500/30 rounded-full group-hover:bg-white/20">
                  <Square size={32} />
                </div>
                <span className="text-xl">Totalement raté</span>
              </button>
            </div>
          ) : (
             <div className="py-12 animate-pulse text-lg font-bold opacity-70">
               En attente du verdict de {p1?.name}...
             </div>
          )}
        </motion.div>
      )}

    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import GameEngine from '../components/GameEngine';
import { Users, ArrowLeft } from 'lucide-react';

export default function LocalRoom() {
  const navigate = useNavigate();
  const [isPlaying, setIsPlaying] = useState(false);
  const [p1Name, setP1Name] = useState('Joueur 1');
  const [p2Name, setP2Name] = useState('Joueur 2');
  const [scores, setScores] = useState({ 0: 0, 1: 0 }); // 0 for p1, 1 for p2
  const [turnIndex, setTurnIndex] = useState(0);

  const players = [
    { id: '1', name: p1Name },
    { id: '2', name: p2Name }
  ];

  const handleGameEnd = (result) => {
    if (result && result.success) {
      // Le joueur qui a imité gagne un point
      const mimicPlayerIndex = turnIndex === 0 ? 1 : 0;
      setScores(prev => ({ ...prev, [mimicPlayerIndex]: prev[mimicPlayerIndex] + 1 }));
    }
    // Inverse les rôles pour la prochaine manche
    setTurnIndex(turnIndex === 0 ? 1 : 0);
    setIsPlaying(false);
  };

  if (isPlaying) {
    return (
      <div className="w-full flex flex-col items-center p-4 min-h-[80vh]">
        <GameEngine 
          players={players} 
          currentTurnIndex={turnIndex} 
          isLocal={true} 
          onGameEnd={handleGameEnd} 
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center justify-center min-h-[80vh] p-4">
      <motion.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 20 }} className="w-full card p-8">
        <button onClick={() => navigate('/')} className="opacity-60 hover:opacity-100 mb-8 flex items-center gap-2 transition-opacity font-medium">
          <ArrowLeft size={20} /> Retour à l'accueil
        </button>
        
        <h1 className="text-3xl font-black mb-8 flex items-center gap-2 justify-center">
          <Users className="text-teal-500" /> Mode Local
        </h1>
        
        <div className="space-y-6 mb-8">
          <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex-1 mr-6">
              <label className="block text-xs font-bold opacity-70 uppercase tracking-wider mb-2">Joueur 1</label>
              <input 
                type="text" 
                value={p1Name}
                onChange={e => setP1Name(e.target.value)}
                className="input-clean font-bold text-lg"
              />
            </div>
            <div className="text-center min-w-[60px]">
              <span className="block text-xs font-bold opacity-50 uppercase tracking-wider mb-1">Score</span>
              <span className="text-4xl font-black text-teal-500">{scores[0]}</span>
            </div>
          </div>
          
          <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex-1 mr-6">
              <label className="block text-xs font-bold opacity-70 uppercase tracking-wider mb-2">Joueur 2</label>
              <input 
                type="text" 
                value={p2Name}
                onChange={e => setP2Name(e.target.value)}
                className="input-clean font-bold text-lg"
              />
            </div>
            <div className="text-center min-w-[60px]">
              <span className="block text-xs font-bold opacity-50 uppercase tracking-wider mb-1">Score</span>
              <span className="text-4xl font-black text-rose-500">{scores[1]}</span>
            </div>
          </div>
        </div>

        <button 
          onClick={() => setIsPlaying(true)}
          disabled={!p1Name.trim() || !p2Name.trim()}
          className="btn-primary w-full text-lg py-4 shadow-lg disabled:opacity-50"
        >
          {scores[0] + scores[1] > 0 ? "Lancer la manche suivante" : "Lancer la partie"}
        </button>
      </motion.div>
    </div>
  );
}

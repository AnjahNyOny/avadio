import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Plus, Play, Lock } from 'lucide-react';
import { roomService } from '../services/roomService';

export default function Home() {
  const [rooms, setRooms] = useState([]);
  const [playerName, setPlayerName] = useState(localStorage.getItem('playerName') || '');
  const [newRoomName, setNewRoomName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = roomService.subscribeToRooms((activeRooms) => {
      setRooms(activeRooms);
    });
    return () => unsubscribe();
  }, []);

  const handleNameChange = (e) => {
    setPlayerName(e.target.value);
    localStorage.setItem('playerName', e.target.value);
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!playerName.trim() || !newRoomName.trim()) return;
    
    const roomId = await roomService.createRoom(newRoomName, playerName);
    if (roomId) {
      navigate(`/room/${roomId}`);
    }
  };

  const handleJoinRequest = async (roomId) => {
    if (!playerName.trim()) {
      alert("Veuillez entrer un pseudo avant de rejoindre !");
      return;
    }
    await roomService.requestJoin(roomId, playerName);
    navigate(`/room/${roomId}?request=true`);
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[80vh]">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-6xl font-black text-teal-500 mb-4 tracking-tight">
          Avadio
        </h1>
        <p className="text-xl opacity-70 mb-8 font-medium">Le défi vocal à l'envers</p>

        <button 
          onClick={() => navigate('/local')}
          className="btn-primary rounded-full transition-transform hover:scale-105 flex items-center justify-center gap-2 mx-auto"
        >
          <Users size={20} /> Jouer en Local (Même écran)
        </button>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-8 w-full">
        {/* Colonne Création */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="card p-6 flex flex-col"
        >
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Plus className="text-teal-500" /> Créer une partie
          </h2>
          
          <div className="mb-6">
            <label className="block text-sm font-bold opacity-70 mb-2 uppercase tracking-wider">Ton pseudo</label>
            <input 
              type="text" 
              value={playerName}
              onChange={handleNameChange}
              placeholder="Ex: JoueurPro99"
              className="input-clean"
            />
          </div>

          {!isCreating ? (
            <button 
              onClick={() => setIsCreating(true)}
              className="btn-primary w-full"
            >
              Nouveau Salon
            </button>
          ) : (
            <form onSubmit={handleCreateRoom} className="flex flex-col gap-4 animate-fade-in">
              <div>
                <label className="block text-sm font-bold opacity-70 mb-2 uppercase tracking-wider">Nom du salon</label>
                <input 
                  type="text" 
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="La room de la rigolade"
                  autoFocus
                  className="input-clean"
                />
              </div>
              <div className="flex gap-2 mt-2">
                <button 
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="flex-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  disabled={!playerName.trim() || !newRoomName.trim()}
                  className="flex-1 btn-primary disabled:opacity-50"
                >
                  Créer
                </button>
              </div>
            </form>
          )}
        </motion.div>

        {/* Colonne Liste des Rooms */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="card p-6 flex flex-col"
        >
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Users className="text-rose-500" /> Salons Actifs
          </h2>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 max-h-[300px]">
            {rooms.length === 0 ? (
              <div className="text-center opacity-50 py-8 italic font-medium">
                Aucun salon disponible pour le moment.<br/>Créez-en un !
              </div>
            ) : (
              rooms.map(room => (
                <div key={room.id} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center justify-between group hover:border-teal-500/50 transition-colors">
                  <div>
                    <h3 className="font-bold">{room.name}</h3>
                    <p className="text-sm opacity-60 flex items-center gap-1 mt-1">
                      <Users size={14} /> {room.playersCount} joueur(s) • {room.state === 'lobby' ? 'En attente' : 'En jeu'}
                    </p>
                  </div>
                  <button 
                    onClick={() => handleJoinRequest(room.id)}
                    disabled={room.state !== 'lobby'}
                    className="bg-slate-200 dark:bg-slate-700 hover:bg-teal-500 hover:text-white p-3 rounded-lg transition-all opacity-80 group-hover:opacity-100 disabled:opacity-50 disabled:hover:bg-slate-200 dark:disabled:hover:bg-slate-700"
                    title={room.state !== 'lobby' ? 'Partie en cours' : 'Rejoindre'}
                  >
                    {room.state !== 'lobby' ? <Lock size={18} /> : <Play size={18} />}
                  </button>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { roomService } from '../services/roomService';
import { auth } from '../firebase';
import { motion } from 'framer-motion';
import { Users, Check, X, LogOut, Play } from 'lucide-react';
import OnlineGameEngine from '../components/OnlineGameEngine';

export default function Room() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const isRequesting = searchParams.get('request') === 'true';

  useEffect(() => {
    const unsubscribe = roomService.subscribeToRoom(roomId, (roomData) => {
      if (!roomData) {
        navigate('/');
        return;
      }
      setRoom(roomData);
    });

    return () => unsubscribe();
  }, [roomId, navigate]);

  if (!room) return <div className="text-center mt-20 opacity-70 font-medium">Chargement...</div>;

  const currentUserId = auth.currentUser?.uid;
  const isHost = room.hostId === currentUserId;
  const isPlayer = room.players && room.players[currentUserId];

  if (isRequesting && !isPlayer && !isHost) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
        <motion.div animate={{ scale: [1, 1.02, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="card p-8">
          <h2 className="text-2xl font-bold mb-4">En attente de l'hôte...</h2>
          <p className="opacity-70">L'hôte doit accepter ta demande pour rejoindre le salon "{room.name}".</p>
        </motion.div>
      </div>
    );
  }

  const handleAccept = (playerId, playerName) => {
    roomService.acceptPlayer(roomId, playerId, playerName);
  };

  const handleReject = (playerId) => {
    roomService.rejectPlayer(roomId, playerId);
  };

  const handleStartGame = () => {
    roomService.startGame(roomId);
  };

  const handleGameEnd = () => {
    roomService.returnToLobby(roomId);
  };

  const handleLeave = async () => {
    await roomService.leaveRoom(roomId);
    navigate('/');
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center min-h-[80vh] p-4">
      <div className="w-full flex justify-between items-center mb-8 card p-5 rounded-xl">
        <div>
          <h1 className="text-2xl font-black">{room.name}</h1>
          <p className="opacity-70 font-medium">Statut: {room.state === 'lobby' ? 'Dans le salon' : 'En jeu'}</p>
        </div>
        <button onClick={handleLeave} className="btn-secondary flex items-center gap-2">
          <LogOut size={18} /> Quitter
        </button>
      </div>

      {room.state === 'playing' ? (
        <OnlineGameEngine roomId={roomId} room={room} />
      ) : (
        <div className="grid md:grid-cols-2 gap-8 w-full">
          {/* Liste des Joueurs */}
          <div className="card p-6">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Users className="text-teal-500" /> Joueurs ({Object.keys(room.players || {}).length})
            </h2>
            <ul className="space-y-3">
              {Object.values(room.players || {}).map(p => (
                <li key={p.id} className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl flex items-center justify-between font-bold">
                  <span>
                    {p.name} 
                    {p.isHost && <span className="ml-3 text-[10px] uppercase tracking-wider bg-teal-500/10 text-teal-600 dark:text-teal-400 px-2 py-1 rounded font-black">Hôte</span>}
                  </span>
                  {p.id === currentUserId && <span className="text-xs opacity-50 uppercase tracking-wider">(Toi)</span>}
                </li>
              ))}
            </ul>
          </div>

          {/* Espace Hôte (Requêtes / Contrôles) */}
          {isHost && room.state === 'lobby' && (
            <div className="card p-6">
              <h2 className="text-xl font-bold mb-6">Demandes en attente</h2>
              {!room.joinRequests || Object.keys(room.joinRequests).length === 0 ? (
                <p className="opacity-50 italic bg-slate-50 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 p-6 rounded-xl text-center">
                  Personne ne frappe à la porte...
                </p>
              ) : (
                <ul className="space-y-3">
                  {Object.values(room.joinRequests).map(req => (
                    <li key={req.id} className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl flex items-center justify-between font-medium">
                      <span>{req.name}</span>
                      <div className="flex gap-2">
                        <button onClick={() => handleAccept(req.id, req.name)} className="bg-emerald-100 dark:bg-emerald-500/20 hover:bg-emerald-200 dark:hover:bg-emerald-500/40 text-emerald-600 dark:text-emerald-400 p-2 rounded-lg transition-colors"><Check size={18} /></button>
                        <button onClick={() => handleReject(req.id)} className="bg-rose-100 dark:bg-rose-500/20 hover:bg-rose-200 dark:hover:bg-rose-500/40 text-rose-600 dark:text-rose-400 p-2 rounded-lg transition-colors"><X size={18} /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              
              <button 
                onClick={handleStartGame}
                className="w-full mt-8 btn-primary flex items-center justify-center gap-2 py-4 text-lg"
                disabled={Object.keys(room.players || {}).length < 2}
              >
                <Play size={20} /> Lancer la partie
              </button>
              {Object.keys(room.players || {}).length < 2 && (
                <p className="text-xs text-center opacity-50 mt-3 font-bold uppercase tracking-wider">Il faut au moins 2 joueurs</p>
              )}
            </div>
          )}
          
          {/* Espace Joueur en Lobby */}
          {!isHost && room.state === 'lobby' && (
            <div className="card p-8 flex flex-col items-center justify-center text-center">
              <div className="animate-pulse mb-6">
                <Users size={48} className="text-teal-500 opacity-50" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Prêt à jouer ?</h2>
              <p className="opacity-70">L'hôte va bientôt lancer la partie...</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

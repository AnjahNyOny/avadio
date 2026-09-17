import { db, auth } from '../firebase';
import { ref, set, push, onValue, remove, update, get, onDisconnect } from "firebase/database";

export const roomService = {
  // Créer une nouvelle room
  async createRoom(roomName, hostName) {
    if (!auth.currentUser) return null;
    
    const hostId = auth.currentUser.uid;
    const roomsRef = ref(db, 'rooms');
    const newRoomRef = push(roomsRef);
    const roomId = newRoomRef.key;

    const roomData = {
      id: roomId,
      name: roomName,
      hostId: hostId,
      state: 'lobby',
      createdAt: Date.now(),
      players: {
        [hostId]: {
          id: hostId,
          name: hostName,
          isHost: true
        }
      }
    };

    await set(newRoomRef, roomData);
    
    // Auto-delete room when host disconnects
    const roomDisconnectRef = onDisconnect(newRoomRef);
    roomDisconnectRef.remove();

    return roomId;
  },

  // Demander à rejoindre une room
  async requestJoin(roomId, playerName) {
    if (!auth.currentUser) return;
    const userId = auth.currentUser.uid;
    
    const requestRef = ref(db, `rooms/${roomId}/joinRequests/${userId}`);
    await set(requestRef, {
      id: userId,
      name: playerName,
      timestamp: Date.now()
    });
    
    // Auto-remove request if user disconnects
    onDisconnect(requestRef).remove();
  },

  // L'hôte accepte un joueur
  async acceptPlayer(roomId, playerId, playerName) {
    const updates = {};
    // Ajouter aux joueurs
    updates[`rooms/${roomId}/players/${playerId}`] = {
      id: playerId,
      name: playerName,
      isHost: false
    };
    // Retirer des requêtes
    updates[`rooms/${roomId}/joinRequests/${playerId}`] = null;
    
    await update(ref(db), updates);
  },

  // L'hôte refuse un joueur
  async rejectPlayer(roomId, playerId) {
    await remove(ref(db, `rooms/${roomId}/joinRequests/${playerId}`));
  },

  // Lancer la partie
  async startGame(roomId) {
    await update(ref(db, `rooms/${roomId}`), {
      state: 'playing'
    });
  },

  // Revenir au lobby
  async returnToLobby(roomId) {
    await update(ref(db, `rooms/${roomId}`), {
      state: 'lobby'
    });
  },

  // Écouter toutes les rooms (pour la page d'accueil)
  subscribeToRooms(callback) {
    const roomsRef = ref(db, 'rooms');
    return onValue(roomsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return callback([]);
      
      const roomsList = Object.values(data).map(room => ({
        id: room.id,
        name: room.name,
        hostId: room.hostId,
        playersCount: room.players ? Object.keys(room.players).length : 0,
        state: room.state
      }));
      
      callback(roomsList);
    });
  },

  // Écouter une room spécifique
  subscribeToRoom(roomId, callback) {
    const roomRef = ref(db, `rooms/${roomId}`);
    return onValue(roomRef, (snapshot) => {
      callback(snapshot.val());
    });
  },
  
  // Quitter une room
  async leaveRoom(roomId) {
    if (!auth.currentUser) return;
    const userId = auth.currentUser.uid;
    
    const roomSnapshot = await get(ref(db, `rooms/${roomId}`));
    if (!roomSnapshot.exists()) return;
    
    const room = roomSnapshot.val();
    
    // Si c'est l'hôte, on supprime la room
    if (room.hostId === userId) {
      await remove(ref(db, `rooms/${roomId}`));
    } else {
      // Sinon on retire juste le joueur
      await remove(ref(db, `rooms/${roomId}/players/${userId}`));
    }
  },

  // ---------------------------------------------------------
  // METHODES POUR LE JEU EN LIGNE (GAME STATE & STORAGE)
  // ---------------------------------------------------------

  // Mettre à jour l'état du jeu à l'intérieur d'une room
  async updateGameState(roomId, stateUpdate) {
    await update(ref(db, `rooms/${roomId}/gameState`), stateUpdate);
  },

  // Uploader un fichier audio en Base64 dans Realtime DB (Gratuit, pas besoin de Storage)
  async uploadAudio(roomId, filename, blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result; // "data:audio/webm;base64,..."
        await set(ref(db, `rooms/${roomId}/audio/${filename}`), base64String);
        // On retourne une fausse URL juste pour notifier OnlineGameEngine
        resolve(`db:${filename}`); 
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },

  // Récupérer un fichier audio depuis Realtime DB
  async getAudio(roomId, filename) {
    const snapshot = await get(ref(db, `rooms/${roomId}/audio/${filename}`));
    return snapshot.val(); // Retourne le base64String
  },

  // Supprimer un fichier audio
  async deleteAudio(roomId, filename) {
    await remove(ref(db, `rooms/${roomId}/audio/${filename}`));
  }
};

export const SUGGESTIONS = [
  // Films & Séries cultes
  "Je suis ton père.",
  "Vers l'infini et au-delà !",
  "Hakuna Matata, mais quelle phrase magnifique !",
  "Que la Force soit avec toi.",
  "Je vole, Jack ! Je vole !",
  "Il est où le culcul, elle est où la têtête ?",
  "Vous voulez un whisky ? Juste un doigt.",
  "C'est un roc, c'est un pic, c'est un cap !",
  "On ne laisse pas Bébé dans un coin.",
  "Houston, nous avons un problème.",
  "Je reviendrai.",
  "La vérité est ailleurs.",
  "Luke, je suis ton père.",
  "C'est à moi que tu parles ?",
  "Mon précieux...",
  "Winter is coming.",
  "Say my name.",
  "Pas de bras, pas de chocolat.",
  
  // Paroles de chansons (Français)
  "Allumer le feu, et faire danser les diables et les dieux.",
  "Je te promets le sel au baiser de ma bouche.",
  "Alors on danse...",
  "Je t'aime à la folie, tu me manques à mourir.",
  "Et tu chantes, chantes, chantes ce refrain qui te plaît.",
  "Sous le soleil des tropiques, l'amour se raconte en musique.",
  "Moi je m'appelle Lolita.",
  "Voyage, voyage, plus loin que la nuit et le jour.",
  "Les démons de minuit m'entraînent jusqu'à l'insomnie.",
  "Libérée, délivrée, je ne mentirai plus jamais.",
  "La bohème, la bohème, ça voulait dire on est heureux.",
  "Sapés comme jamais, lolo le dubaï.",
  "Tu m'as oublié, oh oh oh.",
  
  // Paroles de chansons (Anglais)
  "Never gonna give you up, never gonna let you down.",
  "I will always love you.",
  "Oops, I did it again.",
  "Hello from the other side.",
  "We are the champions, my friends.",
  "I want to break free.",
  "Billie Jean is not my lover.",
  "Hit me baby one more time.",
  "Cause baby you're a firework.",
  "I came in like a wrecking ball.",
  "Let it go, let it go!",
  
  // Phrases drôles / Mèmes / TV
  "C'est pas faux.",
  "Ah ! Denis Brogniart !",
  "Tu es le maillon faible, au revoir.",
  "Je suis le maître du monde !",
  "Mais vous fumez monsieur !",
  "Ça m'en touche une sans faire bouger l'autre.",
  "C'est la pampa ici !",
  "Je ne suis pas gros, je suis un peu enveloppé.",
  "Il fait au moins... -8000 !",
  "Je suis passé par ici, je repasserai par là."
];

export function getRandomSuggestion() {
  const randomIndex = Math.floor(Math.random() * SUGGESTIONS.length);
  return SUGGESTIONS[randomIndex];
}

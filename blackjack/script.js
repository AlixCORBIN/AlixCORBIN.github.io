/*
 * Logique Blackjack Casino Complet
 * - Animations
 * - Règles Françaises (Pas de carte cachée)
 * - Gestion des paris (Bankroll)
 * - Split & Double avec gestion financière
 */

// --- Variables globales ---
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS_KEYS = ['H', 'D', 'C', 'S'];

let deck = [];
let dealerHand = [];
let playerHands = []; 
let currentHandIndex = 0;
let gameActive = false;
let renderedCardsCount = { dealer: 0, player: [] };

// --- Variables d'argent ---
let bankroll = 1000;     // Portefeuille de départ
let currentBetInput = 0; // Mise en cours de préparation
let handBets = [];       // Tableau des mises par main (pour gérer le Split)

// --- Supabase (tracking) ---
const _SB_URL = 'https://njkbhgmwylletmdmsmyl.supabase.co';
const _SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qa2JoZ213eWxsZXRtZG1zbXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NzQ2MzYsImV4cCI6MjA5MjQ1MDYzNn0.Vp6CfEi3dtUL1Z1h8kYkrCAXBMlBuSogocffaKE_9tw';

// Session stats
let _sess = { hands_played:0, hands_won:0, hands_lost:0, hands_push:0, total_wagered:0, net_result:0, splits_used:0, doubles_used:0, blackjacks_hit:0 };
const _bankrollStart = 1000;

function _sendSession() {
    if (_sess.hands_played === 0) return;
    const payload = JSON.stringify({
        hands_played:   _sess.hands_played,
        hands_won:      _sess.hands_won,
        hands_lost:     _sess.hands_lost,
        hands_push:     _sess.hands_push,
        total_wagered:  _sess.total_wagered,
        net_result:     bankroll - _bankrollStart,
        splits_used:    _sess.splits_used,
        doubles_used:   _sess.doubles_used,
        blackjacks_hit: _sess.blackjacks_hit,
        final_bankroll: bankroll
    });
    // Insert direct dans la table (sendBeacon ne supporte pas les headers custom,
    // on passe l'apikey en query string pour l'authentification anon)
    navigator.sendBeacon(
        `${_SB_URL}/rest/v1/blackjack_sessions?apikey=${_SB_KEY}`,
        new Blob([payload], { type: 'application/json' })
    );
    _sess = { hands_played:0, hands_won:0, hands_lost:0, hands_push:0, total_wagered:0, net_result:0, splits_used:0, doubles_used:0, blackjacks_hit:0 };
}

window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') _sendSession();
});

// --- Éléments DOM ---
const dealerHandEl = document.getElementById('dealer-hand');
const dealerScoreEl = document.getElementById('dealer-score');
const playerHandsContainer = document.getElementById('player-hands-container');
const playerScoreEl = document.getElementById('player-score');
const messageArea = document.getElementById('message-area');
const visualDeckEl = document.getElementById('visual-deck');

// Éléments Banque & Paris
const bankrollEl = document.getElementById('bankroll');
const currentBetEl = document.getElementById('current-bet');
const bettingControls = document.getElementById('betting-controls');
const gameControls = document.getElementById('game-controls');

// Boutons Jeu
const btnHit = document.getElementById('btn-hit');
const btnStand = document.getElementById('btn-stand');
const btnDouble = document.getElementById('btn-double');
const btnSplit = document.getElementById('btn-split');
const btnRestart = document.getElementById('btn-restart'); // Sert de bouton "Nouvelle Mise"

// Boutons Paris
const btnDeal = document.getElementById('btn-deal');
const btnClear = document.getElementById('btn-clear');

// --- Initialisation ---
window.onload = initGame;

function initGame() {
    // Listeners Jeu
    btnHit.addEventListener('click', hit);
    btnStand.addEventListener('click', stand);
    btnDouble.addEventListener('click', doubleDown);
    btnSplit.addEventListener('click', splitHand);
    
    // Le bouton restart ramène à l'écran des paris
    btnRestart.addEventListener('click', resetToBettingPhase); 
    
    // Listeners Paris
    btnDeal.addEventListener('click', startNewGame);
    btnClear.addEventListener('click', clearBet);

    initVisualDeck();
    updateBankrollUI();
    resetToBettingPhase(); // On commence par la phase de pari
}

// Crée l'effet de pile de cartes dans le sabot
function initVisualDeck() {
    visualDeckEl.innerHTML = '';
    for(let i=0; i<4; i++) {
        const cardWrapper = document.createElement('div');
        cardWrapper.className = 'shoe-card card-svg';
        cardWrapper.innerHTML = createBackCardSVG();
        visualDeckEl.appendChild(cardWrapper);
    }
}

// --- GESTION DES PARIS ---

// Cette fonction est appelée directement depuis le HTML (onclick="addBet(5)")
window.addBet = function(amount) {
    if (currentBetInput + amount <= bankroll) {
        currentBetInput += amount;
        updateBetUI();
    }
}

function clearBet() {
    currentBetInput = 0;
    updateBetUI();
}

function updateBetUI() {
    currentBetEl.innerText = currentBetInput;
    // On ne peut distribuer que si la mise est > 0
    btnDeal.disabled = (currentBetInput === 0);
}

function updateBankrollUI() {
    bankrollEl.innerText = bankroll;
}

function resetToBettingPhase() {
    // Nettoyage table
    dealerHandEl.innerHTML = '';
    playerHandsContainer.innerHTML = '';
    messageArea.classList.add('hidden');
    btnRestart.classList.add('hidden');
    dealerScoreEl.innerText = '0';
    playerScoreEl.innerText = '0';
    
    // Basculer l'affichage vers les contrôles de paris
    bettingControls.classList.remove('hidden');
    gameControls.classList.add('hidden');
    visualDeckEl.style.opacity = 1;
    
    currentBetInput = 0;
    updateBetUI();
    updateBankrollUI();
}

// --- DÉMARRAGE DU JEU ---

function startNewGame() {
    // Vérification finale
    if (currentBetInput === 0 || currentBetInput > bankroll) return;

    // 1. On valide la mise et on la retire du portefeuille
    bankroll -= currentBetInput;
    updateBankrollUI();

    // 2. Initialisation des variables de jeu
    gameActive = true;
    deck = createDeck();
    shuffleDeck(deck);
    
    dealerHand = [];
    playerHands = [ [] ]; 
    
    // On initialise le tableau des mises : la main 0 a la mise initiale
    handBets = [ currentBetInput ];

    currentHandIndex = 0;
    renderedCardsCount = { dealer: 0, player: [0] };

    // 3. Interface : On cache les paris, on montre le jeu
    bettingControls.classList.add('hidden');
    gameControls.classList.remove('hidden');
    
    // On verrouille tout pendant l'animation de distribution
    toggleGameControls(false); 

    // --- DISTRIBUTION (Type Français : 1 carte croupier) ---
    
    // Carte Joueur 1 (t=0)
    setTimeout(() => { playerHands[0].push(drawCard()); updateUI(); }, 0);
    
    // Carte Croupier 1 (t=300)
    setTimeout(() => { dealerHand.push(drawCard()); updateUI(); }, 300);
    
    // Carte Joueur 2 (t=600)
    setTimeout(() => { playerHands[0].push(drawCard()); updateUI(); }, 300);

    // Déverrouillage après animations (t=1300)
    setTimeout(() => {
         checkForBlackjack();
         // Si le jeu continue (pas de BJ), on active les boutons
         if (gameActive) checkButtonsState(); 
    }, 1300);
}

// --- Logique du Paquet ---
function createDeck() {
    let newDeck = [];
    for(let i=0; i<6; i++) { // 6 paquets
        for (let s of SUITS_KEYS) {
            for (let v of VALUES) {
                newDeck.push({ value: v, suit: s });
            }
        }
    }
    return newDeck;
}

function shuffleDeck(d) {
    for (let i = d.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [d[i], d[j]] = [d[j], d[i]];
    }
}

function drawCard() {
    const card = deck.pop();
    if (deck.length === 0) visualDeckEl.style.opacity = 0;
    return card;
}

// --- Règles et Calculs ---
function getCardWeight(value) {
    if (['J', 'Q', 'K'].includes(value)) return 10;
    if (value === 'A') return 11;
    return parseInt(value);
}

function calculateScore(hand) {
    let score = 0;
    let aces = 0;
    for (let card of hand) {
        score += getCardWeight(card.value);
        if (card.value === 'A') aces++;
    }
    while (score > 21 && aces > 0) { score -= 10; aces--; }
    return score;
}

// --- Actions du Joueur ---

function hit() {
    if (!gameActive) return;
    
    playerHands[currentHandIndex].push(drawCard());
    updateUI(); 
    
    const score = calculateScore(playerHands[currentHandIndex]);
    
    if (score > 21) {
        toggleGameControls(false);
        setTimeout(() => {
             // Sauté : on passe à la main suivante ou fin
             nextHandOrEnd();
        }, 600); 
    } else {
        checkButtonsState();
    }
}

function stand() {
    if (!gameActive) return;
    // On verrouille immédiatement quand on décide de s'arrêter
    toggleGameControls(false);
    nextHandOrEnd();
}

function doubleDown() {
    if (!gameActive) return;

    // Vérification Fonds
    let currentBet = handBets[currentHandIndex];
    if (bankroll < currentBet) {
        showMessage("Fonds insuffisants !", "orange");
        return;
    }

    // Paiement de la 2ème mise
    bankroll -= currentBet;
    handBets[currentHandIndex] += currentBet; // La mise double
    _sess.doubles_used++;
    updateBankrollUI();

    // Action
    playerHands[currentHandIndex].push(drawCard());
    updateUI();
    
    toggleGameControls(false); // Tour fini

    setTimeout(() => {
         const score = calculateScore(playerHands[currentHandIndex]);
         if (score > 21) showMessage("Double... et sauté !", "#ff6b6b");
         nextHandOrEnd();
    }, 600);
}

function splitHand() {
    if (!gameActive) return;

    // Vérification Fonds
    let currentBet = handBets[currentHandIndex];
    if (bankroll < currentBet) {
        showMessage("Fonds insuffisants !", "orange");
        return;
    }

    toggleGameControls(false); 

    // Paiement Split
    bankroll -= currentBet;
    _sess.splits_used++;
    updateBankrollUI();

    // --- LOGIQUE DONNÉES ---
    let handToSplit = playerHands[currentHandIndex];
    let card2 = handToSplit.pop(); 
    
    // Insertion de la nouvelle main dans les données
    playerHands.splice(currentHandIndex + 1, 0, [card2]);
    handBets.splice(currentHandIndex + 1, 0, currentBet);
    
    // Insertion dans les compteurs de rendu
    renderedCardsCount.player[currentHandIndex] = 1;
    renderedCardsCount.player.splice(currentHandIndex + 1, 0, 1);


    // --- LOGIQUE VISUELLE (DOM) ---
    
    // 1. DÉCALAGE DES IDS
    // Si on a déjà des mains après celle-ci, il faut décaler leurs IDs (ex: hand-1 devient hand-2)
    // On part de la fin pour ne pas écraser les IDs
    const totalHandsBeforeSplit = playerHands.length - 1; // Car on a déjà fait le splice
    for (let i = totalHandsBeforeSplit - 1; i > currentHandIndex; i--) {
        const existingHand = document.getElementById(`hand-${i}`);
        if (existingHand) {
            existingHand.id = `hand-${i + 1}`; // On le pousse vers la droite
        }
    }

    // 2. CRÉATION & INSERTION
    const hand1Div = document.getElementById(`hand-${currentHandIndex}`);
    const card2Element = hand1Div.lastElementChild; // La carte à déplacer
    
    const hand2Div = document.createElement('div');
    hand2Div.className = 'hand';
    // Son ID est maintenant libre grâce au décalage ci-dessus
    hand2Div.id = `hand-${currentHandIndex + 1}`; 

    // IMPORTANT : On insère la nouvelle main juste après la main courante
    // (insertBefore insère AVANT le "frère suivant")
    if (hand1Div.nextSibling) {
        playerHandsContainer.insertBefore(hand2Div, hand1Div.nextSibling);
    } else {
        playerHandsContainer.appendChild(hand2Div);
    }

    // 3. DÉPLACEMENT DE LA CARTE
    hand2Div.appendChild(card2Element);


    // --- DISTRIBUTION ---
    setTimeout(() => {
        playerHands[currentHandIndex].push(drawCard());
        updateUI(); // Carte 2 sur la main actuelle

        setTimeout(() => {
            // Astuce : On cible l'index suivant
            let nextHandIndex = currentHandIndex + 1;
            playerHands[nextHandIndex].push(drawCard());
            
            // updateUI rafraîchit tout le monde correctement grâce aux bons IDs
            updateUI(); 

            setTimeout(() => {
                // On réactive les boutons pour continuer à jouer la main actuelle
                // (qui peut être re-splittée si on reçoit encore la même carte !)
                checkButtonsState(); 
            }, 600);
            
        }, 600);
    }, 300);
}

// --- Gestion des tours ---
function nextHandOrEnd() {
    if (currentHandIndex < playerHands.length - 1) {
        // Passage à la main suivante (cas du Split)
        setTimeout(() => {
            currentHandIndex++;
            updateUI(); 
            checkButtonsState(); // Réactive les contrôles pour la nouvelle main
        }, 500);
    } else {
        // Tour Croupier
        dealerTurn();
    }
}

// --- Tour du Croupier ---
function dealerTurn() {
    gameActive = false;
    
    let allBusted = playerHands.every(h => calculateScore(h) > 21);
    
    if (allBusted) {
        setTimeout(determineWinner, 600);
        return;
    }

    let score = calculateScore(dealerHand);
    const playDealer = () => {
        if (score < 17) {
            setTimeout(() => {
                dealerHand.push(drawCard());
                updateUI();
                score = calculateScore(dealerHand);
                playDealer();
            }, 1000); 
        } else {
            setTimeout(determineWinner, 600);
        }
    };
    setTimeout(playDealer, 800);
}

// --- Fin de partie & Paiements ---
function determineWinner() {
    let dealerScore = calculateScore(dealerHand);
    let resultText = "";
    
    playerHands.forEach((hand, index) => {
        let playerScore = calculateScore(hand);
        let bet = handBets[index];
        let winAmount = 0;
        let outcome = "";
        let color = "white";

        _sess.hands_played++;
        _sess.total_wagered += bet;

        if (playerScore > 21) {
            outcome = "Perdu (Sauté)";
            color = "#ff6b6b";
            _sess.hands_lost++;
            // Mise perdue
        }
        else if (dealerScore > 21 || playerScore > dealerScore) {
            // Victoire classique (1:1)
            winAmount = bet * 2;
            bankroll += winAmount;
            outcome = `Gagné (+${bet}€)`;
            color = "#51cf66";
            _sess.hands_won++;
        }
        else if (playerScore < dealerScore) {
            outcome = "Perdu";
            color = "#ff6b6b";
            _sess.hands_lost++;
        }
        else {
            // Push
            winAmount = bet;
            bankroll += winAmount;
            outcome = "Égalité (Mise rendue)";
            _sess.hands_push++;
        }

        let prefix = playerHands.length > 1 ? `Main ${index + 1}: ` : "";
        resultText += `<span style="color:${color}">${prefix}${outcome}</span><br>`;
    });

    updateBankrollUI();
    showMessage(resultText);
    toggleGameControls(false);
    
    btnRestart.innerText = "Nouvelle Mise";
    btnRestart.classList.remove('hidden');
}

function checkForBlackjack() {
    // Blackjack naturel (Main 0, 2 cartes, score 21)
    if(playerHands[0].length === 2 && calculateScore(playerHands[0]) === 21) {
        gameActive = false;
        toggleGameControls(false);
        
        let bet = handBets[0];
        // Blackjack paye 3:2
        let winAmount = bet + (bet * 1.5);
        bankroll += winAmount;
        _sess.hands_played++;
        _sess.hands_won++;
        _sess.blackjacks_hit++;
        _sess.total_wagered += bet;
        updateBankrollUI();
        
        showMessage(`BLACKJACK ! (+${bet * 1.5}€)`, "gold");
        btnRestart.innerText = "Nouvelle Mise";
        btnRestart.classList.remove('hidden');
    }
}

// --- Gestion Interface (UI) ---

// Convertit le string SVG en élément DOM avec animation optionnelle
function renderCardToDOM(cardObj, isHidden = false, animate = false) {
    const wrapper = document.createElement('div');
    wrapper.className = 'card-wrapper';
    
    if (isHidden) {
        wrapper.innerHTML = createBackCardSVG();
    } else {
        wrapper.innerHTML = createCardSVG(cardObj.value, cardObj.suit);
    }

    if (animate) {
        wrapper.classList.add('deal-animation');
    }
    return wrapper;
}

function updateUI() {
    // 1. Croupier
    dealerHand.forEach((card, index) => {
        if (index >= renderedCardsCount.dealer) {
            const cardEl = renderCardToDOM(card, false, true);
            dealerHandEl.appendChild(cardEl);
            renderedCardsCount.dealer++;
        } 
    });

    if (dealerHand.length > 0) {
        dealerScoreEl.innerText = calculateScore(dealerHand);
    } else {
        dealerScoreEl.innerText = '0';
    }

    // 2. Joueur
    playerHands.forEach((hand, handIdx) => {
        let handDiv = document.getElementById(`hand-${handIdx}`);
        
        if (!handDiv) {
            handDiv = document.createElement('div');
            handDiv.className = 'hand';
            handDiv.id = `hand-${handIdx}`;
            playerHandsContainer.appendChild(handDiv);
            renderedCardsCount.player[handIdx] = 0;
        }
        
        handDiv.className = `hand ${handIdx === currentHandIndex ? 'active-hand' : ''}`;

        hand.forEach((card, cardIdx) => {
            if (cardIdx >= renderedCardsCount.player[handIdx]) {
                const cardEl = renderCardToDOM(card, false, true); 
                handDiv.appendChild(cardEl);
                renderedCardsCount.player[handIdx]++;
            }
        });
    });

    playerScoreEl.innerText = calculateScore(playerHands[currentHandIndex]);
}

function toggleGameControls(enable) {
    const btns = [btnHit, btnStand, btnDouble, btnSplit];
    btns.forEach(b => {
        if (enable) {
            b.disabled = false; 
        } else {
            b.disabled = true;
        }
    });
}

function checkButtonsState() {
    if(!gameActive) { toggleGameControls(false); return; }

    toggleGameControls(true); 

    const hand = playerHands[currentHandIndex];
    const currentBet = handBets[currentHandIndex];

    // DOUBLER : 2 cartes + assez d'argent
    if (hand.length !== 2 || bankroll < currentBet) {
        btnDouble.disabled = true;
    }
    
    // SPLIT : 2 cartes identiques
    let val1 = getCardWeight(hand[0].value);
    let val2 = getCardWeight(hand[1].value);

    // CONDITIONS SPLIT :
    // 1. Avoir 2 cartes
    // 2. Même valeur
    // 3. Ne pas dépasser 4 mains au total (CORRECTION ICI)
    // 4. Avoir assez d'argent
    if (hand.length !== 2 || val1 !== val2 || playerHands.length >= 4 || bankroll < currentBet) {
        btnSplit.disabled = true;
    }
}

function showMessage(msg, color = 'white') {
    messageArea.classList.remove('hidden');
    messageArea.style.color = color;
    messageArea.innerHTML = msg;
}
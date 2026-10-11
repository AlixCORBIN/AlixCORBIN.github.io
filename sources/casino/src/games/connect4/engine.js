// Moteur du Puissance 4 : fonctions pures sur l'état de la partie (les délais sont gérés par l'hôte).
import { secureRandomInt } from "../../lib/random.js";
import { fail, ok } from "../../lib/result.js";

export const COLS = 7;
export const ROWS = 6;
export const MAX_PLAYERS = 2;
export const COLORS = [
	{ k: "red", name: "Rouge", hex: "#e8303a" },
	{ k: "yellow", name: "Jaune", hex: "#ffc928" },
];
export const BOT_NAMES = ["Robin", "Margot", "Hugo", "Léna", "Sacha"];
export const BOT_LEVELS = [
	{ v: 1, name: "Facile" },
	{ v: 2, name: "Moyen" },
	{ v: 3, name: "Expert" },
];
export const DEFAULT_SETTINGS = {
	turnMs: 30000, // 0 = pas de limite
	bestOf: 3, // nombre de manches max (premier à la majorité)
	botLevel: 2,
};
export const TURN_CHOICES = [0, 15000, 30000, 60000];
export const BEST_OF = [1, 3, 5];

const MAX_LOG = 40;
const find = ( g, id ) => g.players.find( ( p ) => p.id === id );
export const at = ( grid, c, r ) => grid[r * COLS + c];
export const target = ( bestOf ) => Math.floor( bestOf / 2 ) + 1;

/** Ligne libre la plus basse d'une colonne, ou -1 si pleine. */
export function freeRow( grid, c )
{
	for ( let r = 0; r < ROWS; r++ ) if ( !at( grid, c, r ) ) return r;
	return -1;
}

export const validCols = ( grid ) => [...Array( COLS ).keys()].filter( ( c ) => freeRow( grid, c ) >= 0 );

/** Alignement de 4 (ou plus) passant par la case (c, r) : renvoie les cases, ou null. */
export function lineThrough( grid, c, r )
{
	const v = at( grid, c, r );
	if ( !v ) return null;
	for ( const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]] )
	{
		const cells = [[c, r]];
		for ( const s of [1, -1] )
		{
			let x = c + dc * s;
			let y = r + dr * s;
			while ( x >= 0 && y >= 0 && x < COLS && y < ROWS && at( grid, x, y ) === v )
			{
				cells.push( [x, y] );
				x += dc * s;
				y += dr * s;
			}
		}
		if ( cells.length >= 4 ) return cells;
	}
	return null;
}

export function createConnect4Game()
{
	return {
		game: "connect4",
		phase: "lobby", // lobby | playing | end
		players: [],
		hostId: null,
		settings: { ...DEFAULT_SETTINGS },
		grid: Array( COLS * ROWS ).fill( 0 ),
		turn: 0,
		starter: 0,
		step: "aim", // aim | drop | won | draw | release
		drop: null, // { seq, col, row, by }
		line: null,
		roundWinner: null,
		set: 0,
		draws: 0,
		moveSeq: 0,
		round: 0,
		winner: null,
		log: [],
		seq: 0,
		botSeq: 0,
		gameId: null,
		startedAt: null,
		endedAt: null,
	};
}

function note( g, text, tone )
{
	g.log.push( { id: ++g.seq, text, tone } );
	if ( g.log.length > MAX_LOG ) g.log.splice( 0, g.log.length - MAX_LOG );
}

/* ---------- salle ---------- */

export function addPlayer( g, id, name, { bot = false } = {} )
{
	if ( find( g, id ) ) return fail( "deja present" );
	if ( g.phase !== "lobby" ) return fail( "partie en cours" );
	if ( g.players.length >= MAX_PLAYERS ) return fail( "table pleine" );
	const base = String( name || "Joueur" ).trim().slice( 0, 16 ) || "Joueur";
	let nm = base;
	for ( let i = 2; g.players.some( ( p ) => p.name === nm ); i++ ) nm = `${base} ${i}`;
	g.players.push( { id, name: nm, bot, left: false, roundWins: 0, moves: 0 } );
	if ( !g.hostId ) g.hostId = id;
	return ok();
}

export function addBot( g )
{
	const used = new Set( g.players.map( ( p ) => p.name ) );
	const name = BOT_NAMES.find( ( n ) => !used.has( n ) ) || "Bot";
	return addPlayer( g, "bot-" + ++g.botSeq, name, { bot: true } );
}

export function removeBot( g )
{
	if ( g.phase !== "lobby" ) return fail( "partie en cours" );
	const bot = g.players.find( ( p ) => p.bot );
	if ( !bot ) return fail( "aucun bot" );
	g.players = g.players.filter( ( p ) => p !== bot );
	return ok();
}

export function removePlayer( g, id )
{
	const p = find( g, id );
	if ( !p ) return fail( "absent" );
	if ( g.phase === "lobby" || g.phase === "end" ) g.players = g.players.filter( ( x ) => x !== p );
	else
	{
		p.bot = true;
		p.left = true;
		note( g, `${p.name} a quitté : un bot reprend ses jetons.`, "info" );
	}
	if ( g.hostId === id ) g.hostId = g.players.find( ( x ) => !x.bot )?.id || null;
	return ok();
}

export function setSettings( g, patch )
{
	if ( g.phase !== "lobby" ) return fail( "partie en cours" );
	if ( "turnMs" in patch && TURN_CHOICES.includes( patch.turnMs ) ) g.settings.turnMs = patch.turnMs;
	if ( "bestOf" in patch && BEST_OF.includes( patch.bestOf ) ) g.settings.bestOf = patch.bestOf;
	if ( "botLevel" in patch && BOT_LEVELS.some( ( l ) => l.v === patch.botLevel ) ) g.settings.botLevel = patch.botLevel;
	return ok();
}

/* ---------- partie ---------- */

export function startGame( g )
{
	if ( g.phase !== "lobby" ) return fail( "deja lance" );
	while ( g.players.length < MAX_PLAYERS ) addBot( g );
	g.round++;
	g.phase = "playing";
	g.winner = null;
	g.set = 0;
	g.draws = 0;
	g.log = [];
	g.gameId = crypto.randomUUID();
	g.startedAt = Date.now();
	g.endedAt = null;
	g.players.forEach( ( p ) =>
	{
		p.roundWins = 0;
		p.moves = 0;
	} );
	g.starter = secureRandomInt( 2 );
	newSet( g );
	return ok();
}

function newSet( g )
{
	g.set++;
	g.grid = Array( COLS * ROWS ).fill( 0 );
	g.turn = g.starter;
	g.step = "aim";
	g.drop = null;
	g.line = null;
	g.roundWinner = null;
	const p = g.players[g.turn];
	note( g, g.settings.bestOf > 1 ? `Manche ${g.set} : ${p.name} commence.` : `${p.name} commence.`, "big" );
}

export const current = ( g ) => g.players[g.turn];

export function play( g, id, col )
{
	if ( g.phase !== "playing" || g.step !== "aim" ) return fail( "attends ton tour" );
	const p = current( g );
	if ( p.id !== id ) return fail( "ce n'est pas ton tour" );
	if ( !Number.isInteger( col ) || col < 0 || col >= COLS ) return fail( "colonne invalide" );
	const row = freeRow( g.grid, col );
	if ( row < 0 ) return fail( "colonne pleine" );
	g.grid[row * COLS + col] = g.turn + 1;
	p.moves++;
	g.drop = { seq: ++g.moveSeq, col, row, by: p.id, seat: g.turn };
	g.step = "drop";
	return ok();
}

/** Le jeton a fini de tomber : alignement, grille pleine ou tour suivant. */
export function afterDrop( g )
{
	if ( g.phase !== "playing" || g.step !== "drop" || !g.drop ) return;
	const { col, row } = g.drop;
	const line = lineThrough( g.grid, col, row );
	const p = current( g );
	if ( line )
	{
		g.line = line;
		g.roundWinner = p.id;
		p.roundWins++;
		g.step = "won";
		note( g, `${p.name} aligne 4 jetons !`, "win" );
		return;
	}
	if ( validCols( g.grid ).length === 0 )
	{
		g.step = "draw";
		g.draws++;
		note( g, "Grille pleine : match nul.", "info" );
		return;
	}
	g.turn = 1 - g.turn;
	g.step = "aim";
}

/** Fin de l'affichage du résultat : fin de partie, ou on vide la grille. */
export function afterResult( g )
{
	if ( g.phase !== "playing" || ( g.step !== "won" && g.step !== "draw" ) ) return;
	const need = target( g.settings.bestOf );
	const champ = g.players.find( ( p ) => p.roundWins >= need );
	const played = g.set >= g.settings.bestOf;
	if ( champ || played )
	{
		const [a, b] = g.players;
		g.winner = champ?.id || ( a.roundWins > b.roundWins ? a.id : b.roundWins > a.roundWins ? b.id : null );
		g.phase = "end";
		g.endedAt = Date.now();
		const w = find( g, g.winner );
		note( g, w ? `${w.name} remporte la partie !` : "Égalité parfaite !", "big" );
		return;
	}
	g.step = "release";
}

/** La trappe s'est ouverte et les jetons sont tombés : manche suivante, l'autre joueur commence. */
export function afterRelease( g )
{
	if ( g.phase !== "playing" || g.step !== "release" ) return;
	g.starter = 1 - g.starter;
	newSet( g );
}

/** Temps écoulé : jeton dans une colonne au hasard. */
export function timeoutPlay( g )
{
	if ( g.phase !== "playing" || g.step !== "aim" ) return;
	const p = current( g );
	const cols = validCols( g.grid );
	note( g, `${p.name} tarde : jeton joué au hasard.`, "info" );
	play( g, p.id, cols[secureRandomInt( cols.length )] );
}

export function backToLobby( g )
{
	if ( g.phase !== "end" ) return fail( "partie en cours" );
	g.phase = "lobby";
	g.players = g.players.filter( ( p ) => !p.left );
	g.grid = Array( COLS * ROWS ).fill( 0 );
	g.drop = null;
	g.line = null;
	g.step = "aim";
	return ok();
}

/* ---------- vue (rien de caché au Puissance 4) ---------- */

export function viewFor( g )
{
	return {
		game: "connect4",
		phase: g.phase,
		hostId: g.hostId,
		settings: g.settings,
		round: g.round,
		set: g.set,
		draws: g.draws,
		grid: g.grid,
		turn: g.phase === "playing" ? current( g ).id : null,
		turnSeat: g.turn,
		step: g.step,
		drop: g.drop,
		line: g.line,
		roundWinner: g.roundWinner,
		winner: g.winner,
		players: g.players.map( ( p, i ) => ( {
			id: p.id,
			name: p.name,
			bot: p.bot,
			left: p.left,
			seat: i,
			roundWins: p.roundWins,
			moves: p.moves,
		} ) ),
		log: g.log.slice( -20 ),
	};
}

// IA du Puissance 4 : minimax avec élagage alpha-bêta.
// Facile et Moyen cherchent à profondeur fixe ; Expert approfondit tant qu'il a du temps (sans figer l'écran).
import { secureRandomInt } from "../../lib/random.js";
import { COLS, ROWS, freeRow, lineThrough, validCols } from "./engine.js";

const ORDER = [3, 2, 4, 1, 5, 0, 6]; // le centre d'abord : l'élagage coupe beaucoup plus tôt
const DEPTH = { 1: 2, 2: 4 };
const EXPERT_MS = 300;
const WIN = 1e6;
let deadline = Infinity;
let nodes = 0;
class Timeout extends Error {}

/** Score d'une fenêtre de 4 cases pour le joueur `me` (1 ou 2). */
function windowScore( a, b, c, d, me )
{
	const foe = 3 - me;
	let mine = 0;
	let theirs = 0;
	for ( const v of [a, b, c, d] )
	{
		if ( v === me ) mine++;
		else if ( v === foe ) theirs++;
	}
	if ( mine && theirs ) return 0;
	if ( mine === 3 ) return 50;
	if ( mine === 2 ) return 8;
	if ( theirs === 3 ) return -60;
	if ( theirs === 2 ) return -8;
	return 0;
}

function evaluate( grid, me )
{
	const g = ( c, r ) => grid[r * COLS + c];
	let s = 0;
	for ( let r = 0; r < ROWS; r++ ) if ( g( 3, r ) === me ) s += 6;
	for ( let r = 0; r < ROWS; r++ )
		for ( let c = 0; c < COLS; c++ )
		{
			if ( c + 3 < COLS ) s += windowScore( g( c, r ), g( c + 1, r ), g( c + 2, r ), g( c + 3, r ), me );
			if ( r + 3 < ROWS ) s += windowScore( g( c, r ), g( c, r + 1 ), g( c, r + 2 ), g( c, r + 3 ), me );
			if ( c + 3 < COLS && r + 3 < ROWS ) s += windowScore( g( c, r ), g( c + 1, r + 1 ), g( c + 2, r + 2 ), g( c + 3, r + 3 ), me );
			if ( c + 3 < COLS && r - 3 >= 0 ) s += windowScore( g( c, r ), g( c + 1, r - 1 ), g( c + 2, r - 2 ), g( c + 3, r - 3 ), me );
		}
	return s;
}

function search( grid, depth, alpha, beta, toMove, me )
{
	if ( ++nodes % 2048 === 0 && performance.now() > deadline ) throw new Timeout();
	let moved = false;
	let best = toMove === me ? -Infinity : Infinity;
	for ( const c of ORDER )
	{
		const r = freeRow( grid, c );
		if ( r < 0 ) continue;
		moved = true;
		grid[r * COLS + c] = toMove;
		let v;
		if ( lineThrough( grid, c, r ) ) v = ( toMove === me ? 1 : -1 ) * ( WIN + depth ); // gagner vite, perdre tard
		else if ( depth <= 1 ) v = evaluate( grid, me );
		else v = search( grid, depth - 1, alpha, beta, 3 - toMove, me );
		grid[r * COLS + c] = 0;
		if ( toMove === me )
		{
			best = Math.max( best, v );
			alpha = Math.max( alpha, v );
		}
		else
		{
			best = Math.min( best, v );
			beta = Math.min( beta, v );
		}
		if ( alpha >= beta ) break;
	}
	return moved ? best : 0; // grille pleine : nul
}

/** Meilleurs coups à une profondeur donnée. */
function bestAt( work, me, depth )
{
	let bestV = -Infinity;
	let best = [];
	for ( const c of ORDER )
	{
		const r = freeRow( work, c );
		if ( r < 0 ) continue;
		work[r * COLS + c] = me;
		let v;
		try
		{
			v = lineThrough( work, c, r ) ? WIN * 2 : depth <= 1 ? evaluate( work, me ) : search( work, depth - 1, -Infinity, Infinity, 3 - me, me );
		}
		finally
		{
			work[r * COLS + c] = 0;
		}
		if ( v > bestV )
		{
			bestV = v;
			best = [c];
		}
		else if ( v === bestV ) best.push( c );
	}
	return { best, bestV };
}

/** Colonne choisie par le bot assis en `seat` (0 ou 1). */
export function botMove( grid, seat, level = 2 )
{
	const me = seat + 1;
	const cols = validCols( grid );
	// Facile : un coup sur trois au hasard, pour laisser une chance.
	if ( level <= 1 && secureRandomInt( 3 ) === 0 ) return cols[secureRandomInt( cols.length )];
	const work = grid.slice();
	let best = cols;
	if ( level >= 3 )
	{
		deadline = performance.now() + EXPERT_MS;
		nodes = 0;
		const empty = grid.filter( ( v ) => !v ).length;
		for ( let d = 4; d <= empty; d++ )
		{
			try
			{
				const r = bestAt( work, me, d );
				best = r.best;
				if ( Math.abs( r.bestV ) >= WIN ) break; // issue certaine : inutile de chercher plus loin
			}
			catch ( e )
			{
				if ( !( e instanceof Timeout ) ) throw e;
				break;
			}
		}
		deadline = Infinity;
	}
	else best = bestAt( work, me, DEPTH[level] || 4 ).best;
	return best[secureRandomInt( best.length )] ?? cols[0];
}

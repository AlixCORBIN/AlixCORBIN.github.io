import { saveConnect4Game } from "./api.js";
import { botMove } from "./bots.js";
import {
	COLS,
	ROWS,
	addBot,
	addPlayer,
	afterDrop,
	afterRelease,
	afterResult,
	backToLobby,
	createConnect4Game,
	play,
	removeBot,
	removePlayer,
	setSettings,
	startGame,
	timeoutPlay,
	viewFor,
} from "./engine.js";
import { secureRandomInt } from "../../lib/random.js";
import { fail, ok } from "../../lib/result.js";
import { HostController } from "../../net/controller.js";

// Rythme posé : on voit le jeton tomber, rebondir, puis on laisse le temps de lire la grille.
export const GRAVITY = 32; // cases / s²
export const fallMs = ( row ) => Math.sqrt( ( 2 * ( ROWS - row + 0.7 ) ) / GRAVITY ) * 1000;
const SETTLE_MS = 750; // rebond + temps de lecture
export const RESULT_MS = 3800; // la ligne gagnante brille
export const RELEASE_MS = 2300; // la trappe s'ouvre, les jetons tombent

const speed = () => ( import.meta.env?.DEV && globalThis.__c4Speed ) || 1;
const botDelay = ( min, max ) => ( min + secureRandomInt( max - min ) ) / speed();

export class Connect4Host extends HostController
{
	makeGame()
	{
		return createConnect4Game();
	}
	addPlayer( id, name )
	{
		return addPlayer( this.g, id, name );
	}
	removePlayer( id )
	{
		return removePlayer( this.g, id );
	}
	viewOf()
	{
		const v = viewFor( this.g );
		v.hover = this.hover ?? null;
		return v;
	}
	ensureKeys() {}
	decorate( view )
	{
		view.deadline = this.deadline ? { ms: Math.max( 0, this.deadline - Date.now() ), total: this.deadlineTotal } : null;
	}
	handle( id, a )
	{
		const g = this.g;
		const isHost = id === g.hostId;
		switch ( a?.t )
		{
			case "settings":
				return isHost ? setSettings( g, a.patch || {} ) : fail( "réservé à l'hôte" );
			case "addBot":
				return isHost ? addBot( g ) : fail( "réservé à l'hôte" );
			case "removeBot":
				return isHost ? removeBot( g ) : fail( "réservé à l'hôte" );
			case "start":
				return isHost ? startGame( g ) : fail( "réservé à l'hôte" );
			case "hover":
				// Colonne survolée par le joueur dont c'est le tour : le jeton suit chez tout le monde.
				if ( g.phase !== "playing" || g.step !== "aim" || g.players[g.turn]?.id !== id ) return fail( "" );
				if ( !Number.isInteger( a.col ) || a.col < 0 || a.col >= COLS || a.col === this.hover ) return fail( "" );
				this.hover = a.col;
				return ok();
			case "play":
				return play( g, id, a.col );
			case "restart":
				return isHost ? backToLobby( g ) : fail( "réservé à l'hôte" );
			default:
				return fail( "action inconnue" );
		}
	}
	// Les survols refusés ne doivent pas afficher d'erreur chez le client.
	dispatch( id, action )
	{
		if ( action?.t === "hover" )
		{
			this.lastAct[id] = Date.now();
			if ( this.handle( id, action ).ok ) this.publish();
			return;
		}
		super.dispatch( id, action );
	}
	act( action )
	{
		const res = this.handle( this.me, action ) || { ok: false };
		this.lastError = res.ok || action?.t === "hover" ? null : res.error;
		if ( res.ok ) this.publish();
		else this.emit();
	}

	schedule()
	{
		const g = this.g;
		const sig = [g.phase, g.step, g.turn, g.set, g.drop?.seq].join( "|" );
		if ( sig === this.sig ) return;
		if ( g.phase === "end" && !String( this.sig || "" ).startsWith( "end" ) && g.players.some( ( p ) => !p.bot ) ) saveConnect4Game( g );
		this.sig = sig;
		this.clearTimers();
		this.deadline = null;
		if ( g.phase !== "playing" ) return;
		if ( g.step === "aim" )
		{
			this.hover = 3;
			const p = g.players[g.turn];
			if ( p.bot )
			{
				// Le bot choisit, promène son jeton jusqu'à la colonne, puis le lâche.
				const col = botMove( g.grid, g.turn, g.settings.botLevel );
				const think = botDelay( 900, 1700 );
				const path = [];
				for ( let c = 3; c !== col; c += Math.sign( col - 3 ) ) path.push( c + Math.sign( col - 3 ) );
				path.forEach( ( c, i ) => this.arm( "slide" + i, think * 0.45 + i * 170, () =>
				{
					this.hover = c;
				} ) );
				this.arm( "bot", think + path.length * 170, () => play( g, p.id, col ) );
			}
			else if ( g.settings.turnMs > 0 )
			{
				this.deadline = Date.now() + g.settings.turnMs;
				this.deadlineTotal = g.settings.turnMs;
				this.arm( "deadline", g.settings.turnMs, () => timeoutPlay( g ) );
			}
		}
		else if ( g.step === "drop" )
		{
			this.hover = g.drop.col;
			this.arm( "drop", ( fallMs( g.drop.row ) + SETTLE_MS ) / speed(), () => afterDrop( g ) );
		}
		else if ( g.step === "won" || g.step === "draw" ) this.arm( "result", RESULT_MS / speed(), () => afterResult( g ) );
		else if ( g.step === "release" ) this.arm( "release", RELEASE_MS / speed(), () => afterRelease( g ) );
	}
}

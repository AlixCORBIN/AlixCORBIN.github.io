import { supabase } from "../../lib/supabase.js";

// Appelé une seule fois par l'hôte en fin de partie (RPC save_connect4_game, doublon ignoré côté base).
export async function saveConnect4Game( g )
{
	const players = g.players.map( ( p ) => ( {
		pseudo: p.name,
		bot: !!p.bot,
		won: p.id === g.winner,
		round_wins: p.roundWins,
		moves: p.moves,
	} ) );
	const { error } = await supabase.rpc( "save_connect4_game", {
		p_id: g.gameId || crypto.randomUUID(),
		p_duration: Math.round( ( ( g.endedAt || Date.now() ) - ( g.startedAt || Date.now() ) ) / 1000 ),
		p_rounds: g.set,
		p_draws: g.draws,
		p_bot_level: g.players.some( ( p ) => p.bot ) ? g.settings.botLevel : 0,
		p_players: players,
	} );
	if ( error ) console.warn( "saveConnect4Game", error.message );
}

// Bruitages du Puissance 4, synthétisés en WebAudio (aucun fichier à charger).
// Respecte le bouton muet commun du Casino (sound.isMuted).
import { sound } from "../../lib/sound.js";

let ctx = null;
let master = null;
const audio = () =>
{
	if ( sound.isMuted() ) return null;
	try
	{
		if ( !ctx )
		{
			ctx = new ( window.AudioContext || window.webkitAudioContext )();
			master = ctx.createGain();
			master.gain.value = 0.9;
			master.connect( ctx.destination );
		}
		if ( ctx.state === "suspended" ) ctx.resume();
	}
	catch
	{
		return null;
	}
	return ctx;
};

let noiseBuf = null;
const noiseBuffer = ( c ) =>
{
	if ( !noiseBuf )
	{
		noiseBuf = c.createBuffer( 1, c.sampleRate * 2, c.sampleRate );
		const d = noiseBuf.getChannelData( 0 );
		for ( let i = 0; i < d.length; i++ ) d[i] = Math.random() * 2 - 1;
	}
	return noiseBuf;
};

function noise( { dur, vol = 0.2, type = "bandpass", f0 = 2000, f1 = f0, q = 1, delay = 0 } )
{
	const c = audio();
	if ( !c ) return;
	const t = c.currentTime + delay;
	const src = c.createBufferSource();
	src.buffer = noiseBuffer( c );
	const filter = c.createBiquadFilter();
	filter.type = type;
	filter.Q.value = q;
	filter.frequency.setValueAtTime( f0, t );
	filter.frequency.exponentialRampToValueAtTime( Math.max( 20, f1 ), t + dur );
	const g = c.createGain();
	g.gain.setValueAtTime( vol, t );
	g.gain.exponentialRampToValueAtTime( 0.0001, t + dur );
	src.connect( filter ).connect( g ).connect( master );
	src.start( t, Math.random() );
	src.stop( t + dur + 0.05 );
}

function tone( { f0, f1 = f0, dur, vol = 0.08, type = "sine", attack = 0.005, delay = 0 } )
{
	const c = audio();
	if ( !c ) return;
	const t = c.currentTime + delay;
	const o = c.createOscillator();
	o.type = type;
	o.frequency.setValueAtTime( f0, t );
	o.frequency.exponentialRampToValueAtTime( Math.max( 20, f1 ), t + dur );
	const g = c.createGain();
	g.gain.setValueAtTime( 0.0001, t );
	g.gain.exponentialRampToValueAtTime( vol, t + attack );
	g.gain.exponentialRampToValueAtTime( 0.0001, t + dur );
	o.connect( g ).connect( master );
	o.start( t );
	o.stop( t + dur + 0.05 );
}

/** Choc de plastique : un clac sec, plus grave quand le jeton tombe de haut. */
function clack( vol = 0.3, pitch = 1, delay = 0 )
{
	noise( { dur: 0.07, vol, type: "bandpass", f0: 2600 * pitch, f1: 1400 * pitch, q: 4, delay } );
	tone( { f0: 520 * pitch, f1: 300 * pitch, dur: 0.09, vol: vol * 0.35, type: "triangle", delay } );
}

export const sfx = {
	// Le jeton glisse dans la fente.
	slot()
	{
		noise( { dur: 0.12, vol: 0.08, type: "highpass", f0: 3500, f1: 2000 } );
	},
	// Arrivée du jeton : choc principal + petit rebond (délai en secondes).
	land( row, delay = 0 )
	{
		const pitch = 0.85 + row * 0.06;
		clack( 0.32, pitch, delay );
		clack( 0.1, pitch * 1.1, delay + 0.13 );
	},
	hover()
	{
		tone( { f0: 1900, dur: 0.03, vol: 0.015 } );
	},
	turn()
	{
		tone( { f0: 660, dur: 0.18, vol: 0.06, type: "triangle" } );
		tone( { f0: 990, dur: 0.25, vol: 0.05, type: "triangle", delay: 0.12 } );
	},
	// Quatre notes montantes, une par jeton de la ligne qui s'allume.
	line()
	{
		[523, 659, 784, 1047].forEach( ( f, i ) => tone( { f0: f, dur: 0.35, vol: 0.09, type: "square", delay: i * 0.16 } ) );
		tone( { f0: 1047, f1: 1568, dur: 0.9, vol: 0.06, type: "triangle", delay: 0.7 } );
	},
	draw()
	{
		tone( { f0: 440, f1: 330, dur: 0.6, vol: 0.07, type: "triangle" } );
		tone( { f0: 330, f1: 247, dur: 0.8, vol: 0.06, type: "triangle", delay: 0.35 } );
	},
	// La réglette s'ouvre puis les jetons dégringolent sur la table.
	release( count = 20 )
	{
		tone( { f0: 180, f1: 90, dur: 0.25, vol: 0.12, type: "sawtooth" } );
		noise( { dur: 0.3, vol: 0.12, type: "lowpass", f0: 900, f1: 200 } );
		const n = Math.min( count, 30 );
		for ( let i = 0; i < n; i++ ) clack( 0.06 + Math.random() * 0.12, 0.7 + Math.random() * 0.6, 0.3 + Math.random() * 1.1 );
	},
	start()
	{
		[392, 523].forEach( ( f, i ) => tone( { f0: f, dur: 0.3, vol: 0.07, type: "triangle", delay: i * 0.14 } ) );
	},
};

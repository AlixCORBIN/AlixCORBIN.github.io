import React from "react";
import { BEST_OF, BOT_LEVELS, COLORS, COLS, ROWS, TURN_CHOICES, freeRow, target } from "../engine.js";
import { Connect4Scene } from "../three/Connect4Scene.jsx";
import { sfx } from "../sfx.js";
import { sound } from "../../../lib/sound.js";
import "./connect4.css";

import { AdminName } from "../../../lib/admins.js";
function useCountdown( deadline )
{
	const [left, setLeft] = React.useState( null );
	React.useEffect( () =>
	{
		if ( !deadline ) return setLeft( null );
		const end = Date.now() + deadline.ms;
		const tick = () => setLeft( Math.max( 0, Math.ceil( ( end - Date.now() ) / 1000 ) ) );
		tick();
		const t = setInterval( tick, 250 );
		return () => clearInterval( t );
	}, [deadline] );
	return left;
}

function Header( { ctrl, state, onQuit, left } )
{
	const [copied, setCopied] = React.useState( false );
	const [muted, setMuted] = React.useState( sound.isMuted() );
	const copy = async () =>
	{
		try
		{
			await navigator.clipboard.writeText( `${location.origin}${location.pathname}?room=${ctrl.code}` );
			setCopied( true );
			setTimeout( () => setCopied( false ), 1500 );
		}
		catch {}
	};
	return (
		<header className="topbar">
			<div className="brand">Puissance 4</div>
			{ctrl.code && (
				<button className="pill" onClick={copy} title="Copier le lien d'invitation">
					Salle <b>{ctrl.code}</b> · {copied ? "copié !" : "copier le lien"}
				</button>
			)}
			<div className="grow" />
			{left !== null && state.step === "aim" && (
				<div className="pill c4-timer">
					<b className={left <= 5 ? "hurry" : ""}>{left}s</b>
				</div>
			)}
			<button className="icon" onClick={() => setMuted( sound.toggle() )} title="Son">
				{muted ? "🔇" : "🔊"}
			</button>
			<button className="icon" onClick={onQuit} title="Quitter">
				✕
			</button>
		</header>
	);
}

function Lobby( { ctrl, state, me } )
{
	const host = state.hostId === me.id;
	const s = state.settings;
	const set = ( patch ) => ctrl.act( { t: "settings", patch } );
	const n = state.players.length;
	const hasBot = n < 2 || state.players.some( ( p ) => p.bot );
	return (
		<div className="c4-panel panel">
			<h2>Puissance 4</h2>
			<p className="sub">
				Aligne 4 jetons en ligne, en colonne ou en diagonale
				{ctrl.code ? " · partage le code de salle pour défier un ami" : ""}
			</p>
			<div className="c4-plist">
				{state.players.map( ( p, i ) => (
					<div key={p.id} className={"c4-pl" + ( p.id === me.id ? " me" : "" )} style={{ "--c": COLORS[i].hex }}>
						<i />
						<span>
							{p.id === state.hostId ? "👑 " : ""}
							<AdminName name={p.name} id={p.id} />
						</span>
						<em>{p.bot ? "bot" : "prêt"}</em>
					</div>
				) )}
				{n < 2 && (
					<div className="c4-pl empty" style={{ "--c": COLORS[1].hex }}>
						<i />
						<span>En attente d'un adversaire…</span>
						<em>bot sinon</em>
					</div>
				)}
			</div>
			{host ? (
				<>
					<div className="c4-settings">
						<div className="c4-opt">
							<span>Manches</span>
							<div className="c4-seg">
								{BEST_OF.map( ( b ) => (
									<button key={b} className={s.bestOf === b ? "on" : ""} onClick={() => set( { bestOf: b } )}>
										{b === 1 ? "1" : `${target( b )} gagnantes`}
									</button>
								) )}
							</div>
						</div>
						{hasBot && (
							<div className="c4-opt">
								<span>Niveau du bot</span>
								<div className="c4-seg">
									{BOT_LEVELS.map( ( l ) => (
										<button key={l.v} className={s.botLevel === l.v ? "on" : ""} onClick={() => set( { botLevel: l.v } )}>
											{l.name}
										</button>
									) )}
								</div>
							</div>
						)}
						<label className="c4-opt">
							<span>Temps par coup</span>
							<select value={s.turnMs} onChange={( e ) => set( { turnMs: +e.target.value } )}>
								{TURN_CHOICES.map( ( t ) => (
									<option key={t} value={t}>
										{t === 0 ? "illimité" : `${t / 1000} s`}
									</option>
								) )}
							</select>
						</label>
					</div>
					<div className="row">
						{n === 2 && state.players.some( ( p ) => p.bot ) && (
							<button className="btn ghost" onClick={() => ctrl.act( { t: "removeBot" } )}>
								Retirer le bot
							</button>
						)}
						<button className="btn primary" onClick={() => ctrl.act( { t: "start" } )}>
							{n < 2 ? "Jouer contre un bot" : "Lancer la partie"}
						</button>
					</div>
				</>
			) : (
				<p className="hint">L'hôte lance la partie.</p>
			)}
		</div>
	);
}

function Score( { state } )
{
	const [a, b] = state.players;
	if ( !a || !b ) return null;
	return (
		<div className="c4-score">
			<span className="c4-name" style={{ "--c": COLORS[0].hex }}>
				<i />
				<AdminName name={a.name} id={a.id} />
			</span>
			<b>{a.roundWins}</b>
			<small>{state.settings.bestOf > 1 ? `manche ${state.set}/${state.settings.bestOf}` : "–"}</small>
			<b>{b.roundWins}</b>
			<span className="c4-name" style={{ "--c": COLORS[1].hex }}>
				<AdminName name={b.name} id={b.id} />
				<i />
			</span>
		</div>
	);
}

function Banner( { state, me } )
{
	const p = state.players.find( ( x ) => x.id === state.turn );
	if ( !p || state.step === "release" ) return null;
	if ( state.step === "won" )
	{
		const w = state.players.find( ( x ) => x.id === state.roundWinner );
		return (
			<div key={"w" + state.set} className="c4-splash" style={{ "--c": COLORS[w?.seat ?? 0].hex }}>
				Puissance 4 !<small>{w?.id === me.id ? "Bien joué" : `${w?.name} aligne 4 jetons`}</small>
			</div>
		);
	}
	if ( state.step === "draw" )
		return (
			<div key={"d" + state.set} className="c4-splash draw">
				Match nul<small>La grille est pleine</small>
			</div>
		);
	const mine = p.id === me.id;
	return (
		<div key={state.turn + ":" + state.set} className={"c4-banner" + ( mine ? " mine" : "" )} style={{ "--c": COLORS[p.seat].hex }}>
			<i />
			{state.step === "drop"
				? `${mine ? "Tu joues" : p.name + " joue"} en colonne ${state.drop.col + 1}`
				: mine
					? "À toi ! Choisis une colonne"
					: `${p.name} réfléchit…`}
		</div>
	);
}

function Log( { log } )
{
	return (
		<div className="c4-log">
			{log.slice( -6 ).map( ( l ) => (
				<p key={l.id} className={l.tone}>
					{l.text}
				</p>
			) )}
		</div>
	);
}

function EndPanel( { ctrl, state, me } )
{
	const won = state.winner === me.id;
	const winner = state.players.find( ( p ) => p.id === state.winner );
	return (
		<div className="c4-panel panel c4-end">
			<h2>{!winner ? "Égalité" : won ? "Victoire !" : `${winner.name} gagne`}</h2>
			<p className="sub">{!winner ? "Personne ne l'emporte cette fois." : won ? "Quatre jetons bien alignés." : "Revanche ?"}</p>
			<div className="c4-endstats">
				{state.players.map( ( p ) => (
					<div key={p.id} className={p.id === state.winner ? "won" : ""} style={{ "--c": COLORS[p.seat].hex }}>
						<b>
							<i />
							{p.bot ? "🤖 " : ""}
							<AdminName name={p.name} id={p.id} />
						</b>
						<span>
							{p.roundWins} manche{p.roundWins > 1 ? "s" : ""} · {p.moves} jetons
						</span>
					</div>
				) )}
			</div>
			{state.hostId === me.id ? (
				<button className="btn primary" onClick={() => ctrl.act( { t: "restart" } )}>
					Nouvelle partie
				</button>
			) : (
				<p className="hint">L'hôte peut relancer une partie.</p>
			)}
		</div>
	);
}

export function Connect4Screen( { ctrl, state, me, onQuit } )
{
	if ( import.meta.env.DEV ) window.__c4Ctrl = ctrl;
	const left = useCountdown( state.deadline );
	const [hover, setHover] = React.useState( 3 );
	const [err, setErr] = React.useState( null );
	const myTurn = state.phase === "playing" && state.step === "aim" && state.turn === me.id;
	const prev = React.useRef( {} );

	// Bruitages, déclenchés par les changements d'étape (identiques chez tous les joueurs).
	React.useEffect( () =>
	{
		const last = prev.current;
		if ( state.phase === "playing" && last.phase !== "playing" ) sfx.start();
		if ( state.step === "drop" && last.drop !== state.drop?.seq ) sfx.slot();
		if ( state.step === "won" && last.step !== "won" ) setTimeout( () => sfx.line(), 250 );
		if ( state.step === "draw" && last.step !== "draw" ) sfx.draw();
		if ( myTurn && !last.myTurn ) setTimeout( () => sfx.turn(), 200 );
		if ( state.phase === "end" && last.phase !== "end" && state.winner ) setTimeout( () => ( state.winner === me.id ? sound.win : sound.lose )(), 600 );
		prev.current = { phase: state.phase, step: state.step, drop: state.drop?.seq, myTurn };
	} );

	React.useEffect( () =>
	{
		if ( !ctrl.lastError ) return;
		setErr( ctrl.lastError );
		const t = setTimeout( () => setErr( null ), 2000 );
		return () => clearTimeout( t );
	}, [ctrl.lastError, ctrl.getSnapshot()] );

	// Au début de mon tour, le jeton repart de la dernière colonne visée.
	React.useEffect( () =>
	{
		if ( myTurn && state.hover != null ) setHover( state.hover );
	}, [myTurn] );

	const aim = ( c ) =>
	{
		if ( c === hover ) return;
		setHover( c );
		sfx.hover();
		ctrl.act( { t: "hover", col: c } );
	};
	const drop = ( c ) =>
	{
		if ( freeRow( state.grid, c ) < 0 ) return setErr( "Colonne pleine" );
		ctrl.act( { t: "play", col: c } );
	};

	// Clavier : ← → pour viser, Entrée / Espace / ↓ pour lâcher, 1 à 7 pour jouer directement.
	React.useEffect( () =>
	{
		if ( !myTurn ) return;
		const onKey = ( e ) =>
		{
			if ( e.target?.tagName === "INPUT" || e.target?.tagName === "SELECT" ) return;
			if ( e.key === "ArrowLeft" ) aim( Math.max( 0, hover - 1 ) );
			else if ( e.key === "ArrowRight" ) aim( Math.min( COLS - 1, hover + 1 ) );
			else if ( e.key === "Enter" || e.key === " " || e.key === "ArrowDown" ) drop( hover );
			else if ( /^[1-7]$/.test( e.key ) ) drop( +e.key - 1 );
			else return;
			e.preventDefault();
		};
		window.addEventListener( "keydown", onKey );
		return () => window.removeEventListener( "keydown", onKey );
	}, [myTurn, hover, state.grid] );

	const playing = state.phase === "playing";
	const hoverCol = myTurn ? hover : state.hover;
	const filled = state.grid.filter( Boolean ).length;

	return (
		<div className="c4-root">
			<Connect4Scene state={state} meId={me.id} hoverCol={hoverCol} onHover={aim} onPlay={drop} />
			<Header ctrl={ctrl} state={state} onQuit={onQuit} left={left} />
			{state.phase === "lobby" && <Lobby ctrl={ctrl} state={state} me={me} />}
			{playing && (
				<>
					<Score state={state} />
					<Banner state={state} me={me} />
					<Log log={state.log} />
					{myTurn && (
						<div className="c4-bottom">
							{err && <div className="toast">{err}</div>}
							<div className="c4-cols">
								{Array.from( { length: COLS }, ( _, c ) => (
									<button key={c} className={hover === c ? "on" : ""} disabled={freeRow( state.grid, c ) < 0} onClick={() => drop( c )} onPointerEnter={() => aim( c )}>
										{c + 1}
									</button>
								) )}
							</div>
							<p className="hint">Clique une colonne · ← → puis Entrée · touches 1 à 7</p>
						</div>
					)}
					{!myTurn && err && (
						<div className="c4-bottom">
							<div className="toast">{err}</div>
						</div>
					)}
					<div className="c4-fill" title="Jetons dans la grille">
						{filled}/{COLS * ROWS}
					</div>
				</>
			)}
			{state.phase === "end" && <EndPanel ctrl={ctrl} state={state} me={me} />}
		</div>
	);
}

import { Html, Sparkles } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import React from "react";
import * as THREE from "three";
import { useRoomMii } from "../../../lib/mii.js";
import { MiiAvatar } from "../../../ui/MiiAvatar.jsx";
import { COLORS, COLS, ROWS } from "../engine.js";
import { GRAVITY, RELEASE_MS } from "../host.js";
import { sfx } from "../sfx.js";

import { AdminName } from "../../../lib/admins.js";
const BASE_Y = 0.75; // bas de la grille
const R_TOKEN = 0.44;
const T_TOKEN = 0.22;
const R_HOLE = 0.375;
const BW = COLS + 0.7;
const TOP_Y = BASE_Y + ROWS + 1.2; // hauteur du jeton qu'on tient au-dessus de la grille
const TABLE_Y = 0;
export const cellXY = ( c, r ) => [c - ( COLS - 1 ) / 2, BASE_Y + r + 0.5];
const MII_X = 5.9;

/* ---------------- matériaux partagés ---------------- */

const tokenGeo = new THREE.CylinderGeometry( R_TOKEN, R_TOKEN, T_TOKEN, 40 );
tokenGeo.rotateX( Math.PI / 2 );
const grooveGeo = new THREE.TorusGeometry( R_TOKEN * 0.68, 0.022, 8, 40 );
const tokenMats = COLORS.map(
	( c ) => new THREE.MeshPhysicalMaterial( { color: c.hex, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 } ),
);
const grooveMats = COLORS.map(
	( c ) => new THREE.MeshPhysicalMaterial( { color: new THREE.Color( c.hex ).multiplyScalar( 0.72 ), roughness: 0.4 } ),
);

function TokenMesh( { seat, glow = 0, mat } )
{
	return (
		<group>
			<mesh geometry={tokenGeo} material={mat || tokenMats[seat]} castShadow />
			<mesh geometry={grooveGeo} material={grooveMats[seat]} position-z={T_TOKEN / 2} />
			<mesh geometry={grooveGeo} material={grooveMats[seat]} position-z={-T_TOKEN / 2} />
			{glow > 0 && (
				<mesh position-z={0.001}>
					<circleGeometry args={[R_TOKEN * 1.35, 40]} />
					<meshBasicMaterial color={COLORS[seat].hex} transparent opacity={0.25 * glow} depthWrite={false} toneMapped={false} />
				</mesh>
			)}
		</group>
	);
}

/* ---------------- table et décor ---------------- */

function woodTexture()
{
	const c = document.createElement( "canvas" );
	c.width = 1024;
	c.height = 512;
	const ctx = c.getContext( "2d" );
	ctx.fillStyle = "#5a3620";
	ctx.fillRect( 0, 0, c.width, c.height );
	// planches + veinage
	for ( let p = 0; p < 6; p++ )
	{
		const y0 = ( p * c.height ) / 6;
		ctx.fillStyle = `hsl(24, 45%, ${22 + ( ( p * 37 ) % 7 )}%)`;
		ctx.fillRect( 0, y0, c.width, c.height / 6 - 3 );
		for ( let i = 0; i < 26; i++ )
		{
			ctx.strokeStyle = `rgba(30,14,6,${0.08 + Math.random() * 0.12})`;
			ctx.lineWidth = 1 + Math.random() * 2;
			ctx.beginPath();
			const yy = y0 + Math.random() * ( c.height / 6 );
			ctx.moveTo( 0, yy );
			for ( let x = 0; x <= c.width; x += 32 ) ctx.lineTo( x, yy + Math.sin( x * 0.012 + i ) * 3 + Math.random() * 1.5 );
			ctx.stroke();
		}
	}
	const t = new THREE.CanvasTexture( c );
	t.colorSpace = THREE.SRGBColorSpace;
	t.wrapS = t.wrapT = THREE.RepeatWrapping;
	t.repeat.set( 2, 2 );
	t.anisotropy = 8;
	return t;
}

function Table()
{
	const tex = React.useMemo( woodTexture, [] );
	return (
		<group>
			<mesh position={[0, TABLE_Y - 0.3, 1]} receiveShadow>
				<boxGeometry args={[24, 0.6, 12]} />
				<meshStandardMaterial map={tex} roughness={0.55} />
			</mesh>
			{/* tapis de feutre sous le plateau */}
			<mesh position={[0, TABLE_Y + 0.004, 0.6]} rotation-x={-Math.PI / 2} receiveShadow>
				<planeGeometry args={[11, 5.2]} />
				<meshStandardMaterial color="#1d3b2c" roughness={0.95} />
			</mesh>
		</group>
	);
}

/* ---------------- plateau ---------------- */

function plateGeometry()
{
	const w = BW / 2;
	const y0 = BASE_Y - 0.28;
	const y1 = BASE_Y + ROWS + 0.25;
	const rad = 0.3;
	const s = new THREE.Shape();
	s.moveTo( -w + rad, y0 );
	s.lineTo( w - rad, y0 );
	s.quadraticCurveTo( w, y0, w, y0 + rad );
	s.lineTo( w, y1 - rad );
	s.quadraticCurveTo( w, y1, w - rad, y1 );
	s.lineTo( -w + rad, y1 );
	s.quadraticCurveTo( -w, y1, -w, y1 - rad );
	s.lineTo( -w, y0 + rad );
	s.quadraticCurveTo( -w, y0, -w + rad, y0 );
	for ( let c = 0; c < COLS; c++ )
		for ( let r = 0; r < ROWS; r++ )
		{
			const [x, y] = cellXY( c, r );
			const h = new THREE.Path();
			h.absarc( x, y, R_HOLE, 0, Math.PI * 2, true );
			s.holes.push( h );
		}
	const g = new THREE.ExtrudeGeometry( s, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2, curveSegments: 28 } );
	return g;
}

function Board( { release } )
{
	const geo = React.useMemo( plateGeometry, [] );
	const mat = React.useMemo( () => new THREE.MeshPhysicalMaterial( { color: "#1d4fc4", roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.2 } ), [] );
	const dark = React.useMemo( () => new THREE.MeshStandardMaterial( { color: "#163c96", roughness: 0.4 } ), [] );
	const slider = React.useRef();
	useFrame( () =>
	{
		if ( !slider.current ) return;
		const t = release ? Math.min( 1, ( performance.now() - release ) / 260 ) : 0;
		slider.current.position.x += ( ( release ? 1 : 0 ) * BW * 0.92 * t - slider.current.position.x ) * ( release ? 1 : 0.08 );
	} );
	const postH = BASE_Y + ROWS + 0.55;
	return (
		<group>
			<mesh geometry={geo} material={mat} position-z={0.125} castShadow receiveShadow />
			<mesh geometry={geo} material={mat} position-z={-0.22} castShadow receiveShadow />
			{/* montants et pieds */}
			{[-1, 1].map( ( side ) => (
				<group key={side} position-x={side * ( BW / 2 + 0.12 )}>
					<mesh position-y={postH / 2} material={dark} castShadow receiveShadow>
						<boxGeometry args={[0.26, postH, 0.5]} />
					</mesh>
					<mesh position={[0, 0.1, 0]} material={dark} castShadow receiveShadow>
						<boxGeometry args={[0.38, 0.2, 2.6]} />
					</mesh>
					<mesh position-y={postH} material={dark} castShadow>
						<sphereGeometry args={[0.17, 16, 12]} />
					</mesh>
				</group>
			) )}
			{/* réglette du fond : elle coulisse pour libérer les jetons */}
			<group ref={slider}>
				<mesh position={[0.35, BASE_Y - 0.1, -0.05]} material={dark} castShadow>
					<boxGeometry args={[BW + 0.7, 0.12, 0.2]} />
				</mesh>
				<mesh position={[BW / 2 + 0.75, BASE_Y - 0.1, -0.05]} material={mat} castShadow>
					<boxGeometry args={[0.18, 0.42, 0.42]} />
				</mesh>
			</group>
		</group>
	);
}

/* ---------------- jetons ---------------- */

/** Jeton posé dans la grille ; s'il vient d'être joué, il tombe depuis le haut avec un petit rebond. */
function Token( { c, r, seat, fallAt, inLine, dim } )
{
	const ref = React.useRef();
	const [x, y] = cellXY( c, r );
	const landed = React.useRef( !fallAt );
	useFrame( ( st ) =>
	{
		const g = ref.current;
		if ( !g ) return;
		let yy = y;
		if ( fallAt )
		{
			const t = ( performance.now() - fallAt ) / 1000;
			const tLand = Math.sqrt( ( 2 * ( TOP_Y - y ) ) / GRAVITY );
			if ( t < tLand ) yy = TOP_Y - 0.5 * GRAVITY * t * t;
			else
			{
				if ( !landed.current )
				{
					landed.current = true;
					sfx.land( r );
				}
				const tau = t - tLand;
				yy = y + 0.16 * Math.exp( -7 * tau ) * Math.abs( Math.sin( tau * 15 ) );
			}
		}
		g.position.set( x, yy, 0 );
		if ( inLine )
		{
			const k = 1 + Math.sin( st.clock.elapsedTime * 7 ) * 0.07;
			g.scale.set( k, k, 1 );
		}
		else g.scale.set( 1, 1, 1 );
	} );
	return (
		<group ref={ref} position={[x, fallAt ? TOP_Y : y, 0]}>
			<TokenMesh seat={seat} glow={inLine ? 1 : 0} mat={dim ? dimMats[seat] : undefined} />
		</group>
	);
}

const dimMats = COLORS.map(
	( c ) => new THREE.MeshPhysicalMaterial( { color: new THREE.Color( c.hex ).multiplyScalar( 0.45 ), roughness: 0.5 } ),
);

/** Jeton que le joueur actif promène au-dessus des colonnes. */
function HeldToken( { seat, col } )
{
	const ref = React.useRef();
	useFrame( ( st, dt ) =>
	{
		const g = ref.current;
		if ( !g ) return;
		const tx = cellXY( col, 0 )[0];
		g.position.x += ( tx - g.position.x ) * ( 1 - Math.exp( -14 * Math.min( dt, 0.05 ) ) );
		g.position.y = TOP_Y + Math.sin( st.clock.elapsedTime * 3 ) * 0.06;
	} );
	return (
		<group ref={ref} position={[cellXY( col, 0 )[0], TOP_Y, 0]}>
			<TokenMesh seat={seat} />
		</group>
	);
}

function ColumnGlow( { col, seat, full } )
{
	const ref = React.useRef();
	useFrame( ( _s, dt ) =>
	{
		if ( ref.current ) ref.current.position.x += ( cellXY( col, 0 )[0] - ref.current.position.x ) * ( 1 - Math.exp( -16 * Math.min( dt, 0.05 ) ) );
	} );
	return (
		<mesh ref={ref} position={[cellXY( col, 0 )[0], BASE_Y + ROWS / 2, 0.24]}>
			<planeGeometry args={[0.92, ROWS + 0.3]} />
			<meshBasicMaterial color={full ? "#777" : COLORS[seat].hex} transparent opacity={0.13} depthWrite={false} toneMapped={false} />
		</mesh>
	);
}

/** Trait lumineux qui barre les 4 jetons alignés. */
function WinBar( { line, seat } )
{
	const ref = React.useRef();
	const born = React.useRef( performance.now() );
	const sorted = [...line].sort( ( a, b ) => a[0] - b[0] || a[1] - b[1] );
	const [x0, y0] = cellXY( ...sorted[0] );
	const [x1, y1] = cellXY( ...sorted[sorted.length - 1] );
	const len = Math.hypot( x1 - x0, y1 - y0 ) + 0.7;
	const ang = Math.atan2( y1 - y0, x1 - x0 );
	useFrame( () =>
	{
		const t = Math.min( 1, ( performance.now() - born.current ) / 700 );
		if ( ref.current ) ref.current.scale.x = 1 - Math.pow( 1 - t, 3 );
	} );
	return (
		<group position={[( x0 + x1 ) / 2, ( y0 + y1 ) / 2, 0.36]} rotation-z={ang}>
			<group ref={ref} scale-x={0}>
				<mesh>
					<planeGeometry args={[len, 0.14]} />
					<meshBasicMaterial color="#ffffff" toneMapped={false} />
				</mesh>
				<mesh position-z={-0.01}>
					<planeGeometry args={[len + 0.2, 0.42]} />
					<meshBasicMaterial color={COLORS[seat].hex} transparent opacity={0.55} depthWrite={false} toneMapped={false} />
				</mesh>
			</group>
		</group>
	);
}

/** La réglette s'ouvre : les jetons tombent par le bas et s'éparpillent sur la table. */
function Released( { grid, startAt } )
{
	const refs = React.useRef( [] );
	const bodies = React.useMemo( () =>
	{
		const out = [];
		let i = 0;
		for ( let r = 0; r < ROWS; r++ )
			for ( let c = 0; c < COLS; c++ )
			{
				const v = grid[r * COLS + c];
				if ( !v ) continue;
				const [x, y] = cellXY( c, r );
				const rnd = ( k ) =>
				{
					const s = Math.sin( ( i + 1 ) * 91.7 + k * 13.1 ) * 43758.5;
					return s - Math.floor( s );
				};
				out.push( {
					seat: v - 1,
					p: new THREE.Vector3( x, y, 0 ),
					v: new THREE.Vector3( 0, 0, 0 ),
					kick: new THREE.Vector3( ( rnd( 1 ) - 0.5 ) * 2.6, 0, 1.2 + rnd( 2 ) * 2.4 ),
					spin: ( rnd( 3 ) - 0.5 ) * 9,
					rot: new THREE.Euler( 0, 0, 0 ),
					out: false,
					flat: 0,
				} );
				i++;
			}
		return out;
	}, [] );
	const last = React.useRef( performance.now() );
	useFrame( () =>
	{
		const now = performance.now();
		const dt = Math.min( 0.04, ( now - last.current ) / 1000 );
		last.current = now;
		const t = now - startAt;
		if ( t < 280 ) return; // la réglette coulisse d'abord
		const fade = THREE.MathUtils.clamp( ( RELEASE_MS - t ) / 450, 0, 1 );
		bodies.forEach( ( b, i ) =>
		{
			const m = refs.current[i];
			if ( !m ) return;
			b.v.y -= 30 * dt;
			if ( !b.out && b.p.y < BASE_Y - 0.4 )
			{
				b.out = true;
				b.v.x += b.kick.x;
				b.v.z += b.kick.z;
			}
			b.p.addScaledVector( b.v, dt );
			const floor = TABLE_Y + T_TOKEN / 2;
			if ( b.p.y < floor )
			{
				b.p.y = floor;
				if ( b.v.y < -1.5 ) sfx.land( 2 + ( i % 3 ), 0 );
				b.v.y = Math.abs( b.v.y ) > 1.5 ? -b.v.y * 0.28 : 0;
				b.v.x *= 0.6;
				b.v.z *= 0.6;
				b.spin *= 0.6;
			}
			if ( b.out ) b.flat = Math.min( 1, b.flat + dt * 2.4 );
			b.rot.set( ( -Math.PI / 2 ) * b.flat, b.rot.y + b.spin * dt * 0.3, b.rot.z + b.spin * dt );
			m.position.copy( b.p );
			m.rotation.copy( b.rot );
			m.scale.setScalar( fade );
		} );
	} );
	return bodies.map( ( b, i ) => (
		<group key={i} ref={( m ) => ( refs.current[i] = m )} position={b.p.toArray()}>
			<TokenMesh seat={b.seat} />
		</group>
	) );
}

/* ---------------- joueurs (Mii) ---------------- */

function Player( { p, side, active, won, score, target } )
{
	const mii = useRoomMii( p );
	const ref = React.useRef();
	const ring = React.useRef();
	useFrame( ( st ) =>
	{
		const t = st.clock.elapsedTime;
		if ( ref.current ) ref.current.position.y = 0.24 + ( won ? Math.abs( Math.sin( t * 5 ) ) * 0.4 : 0 );
		if ( ring.current ) ring.current.opacity = active ? 0.6 + Math.sin( t * 4 ) * 0.3 : 0.15;
	} );
	const color = COLORS[p.seat].hex;
	return (
		<group position={[side * MII_X, TABLE_Y, 0.4]} rotation-y={-side * 0.35}>
			<mesh position-y={0.11} castShadow receiveShadow>
				<cylinderGeometry args={[0.9, 0.98, 0.22, 36]} />
				<meshPhysicalMaterial color={color} roughness={0.35} clearcoat={0.5} />
			</mesh>
			<mesh position-y={0.012} rotation-x={-Math.PI / 2}>
				<ringGeometry args={[1.02, 1.3, 40]} />
				<meshBasicMaterial ref={ring} color={color} transparent opacity={0.2} depthWrite={false} toneMapped={false} />
			</mesh>
			<group ref={ref}>
				<MiiAvatar mii={mii} scale={1.55} />
			</group>
			<Html position={[0, -0.05, 1.15]} center zIndexRange={[20, 0]}>
				<div className={"c4-plate" + ( active ? " turn" : "" )} style={{ "--c": color }}>
					<i />
					<span>
						{p.bot ? "🤖 " : ""}
						<AdminName name={p.name} id={p.id} />
					</span>
					{target > 1 && (
						<em>
							{Array.from( { length: target }, ( _, k ) => (
								<b key={k} className={k < score ? "on" : ""} />
							) )}
						</em>
					)}
				</div>
			</Html>
		</group>
	);
}

/* ---------------- caméra ---------------- */

function Rig( { focus } )
{
	const { camera, size } = useThree();
	const look = React.useRef( new THREE.Vector3( 0, 3.6, 0 ) );
	useFrame( ( st, dt ) =>
	{
		const aspect = size.width / size.height;
		// Écran large : plateau + Mii. Écran en hauteur : on garde au moins le plateau en entier.
		const needW = 4.6 + 4 * THREE.MathUtils.clamp( ( aspect - 0.6 ) / 0.8, 0, 1 );
		const f = THREE.MathUtils.clamp( needW / ( Math.tan( THREE.MathUtils.degToRad( camera.fov / 2 ) ) * aspect * 14.6 ), 1, 3 );
		const { pos, at, speed = 1.6, sway = 0 } = focus;
		const k = 1 - Math.exp( -speed * Math.min( dt, 0.05 ) );
		const s = Math.sin( st.clock.elapsedTime * 0.25 ) * sway;
		const tx = at[0] + ( pos[0] + s - at[0] ) * f;
		const ty = at[1] + ( pos[1] - at[1] ) * f;
		const tz = at[2] + ( pos[2] - at[2] ) * f;
		camera.position.x += ( tx - camera.position.x ) * k;
		camera.position.y += ( ty - camera.position.y ) * k;
		camera.position.z += ( tz - camera.position.z ) * k;
		look.current.x += ( at[0] - look.current.x ) * k;
		look.current.y += ( at[1] - look.current.y ) * k;
		look.current.z += ( at[2] - look.current.z ) * k;
		camera.lookAt( look.current );
	} );
	return null;
}

/* ---------------- scène ---------------- */

export function Connect4Scene( { state, meId, hoverCol, onHover, onPlay } )
{
	const playing = state.phase === "playing";
	const seat = state.turnSeat;
	const myTurn = playing && state.step === "aim" && state.turn === meId;
	const lineSet = React.useMemo( () => new Set( ( state.line || [] ).map( ( [c, r] ) => c + "," + r ) ), [state.line] );
	const showLine = !!state.line && ( state.step === "won" || state.phase === "end" );

	// Horodatage local des chutes et de l'ouverture de la réglette.
	const falls = React.useRef( {} );
	const [releaseAt, setReleaseAt] = React.useState( null );
	const releaseGrid = React.useRef( null );
	if ( state.drop && state.step === "drop" && !falls.current[state.drop.seq] ) falls.current[state.drop.seq] = performance.now();
	React.useEffect( () =>
	{
		if ( playing && state.step === "release" && !releaseAt )
		{
			releaseGrid.current = state.grid.slice();
			setReleaseAt( performance.now() );
			sfx.release( state.grid.filter( Boolean ).length );
		}
		if ( state.step !== "release" && releaseAt ) setReleaseAt( null );
	}, [state.step, state.set] );

	const focus = React.useMemo( () =>
	{
		if ( !playing ) return { pos: [0, 6.2, 15.5], at: [0, 3.2, 0], speed: 0.9, sway: 2.5 };
		if ( state.step === "won" && state.line )
		{
			const pts = state.line.map( ( [c, r] ) => cellXY( c, r ) );
			const cx = pts.reduce( ( s, p ) => s + p[0], 0 ) / pts.length;
			const cy = pts.reduce( ( s, p ) => s + p[1], 0 ) / pts.length;
			return { pos: [cx * 0.5, cy + 1.6, 10.5], at: [cx * 0.8, cy + 0.3, 0], speed: 1.4 };
		}
		if ( state.step === "release" ) return { pos: [1.5, 3.4, 10.5], at: [0, 1.4, 0.8], speed: 1.5 };
		return { pos: [0, 6.3, 14.5], at: [0, 4.5, 0], speed: 1.3 };
	}, [playing, state.step, state.set] );

	const grid = state.step === "release" ? null : state.grid;
	const dropSeq = state.drop?.seq;
	const cols = playing && state.step === "aim" ? hoverCol ?? 3 : state.drop?.col ?? 3;
	const colFull = grid && grid[( ROWS - 1 ) * COLS + cols];
	// Le joueur rouge (siège 0) à gauche, le jaune à droite : identique pour tout le monde.
	const bySeat = [0, 1].map( ( s ) => state.players.find( ( p ) => p.seat === s ) );
	const need = Math.floor( state.settings.bestOf / 2 ) + 1;

	const pick = ( e ) =>
	{
		const c = Math.floor( e.point.x + COLS / 2 );
		return c >= 0 && c < COLS ? c : null;
	};

	return (
		<Canvas
			shadows
			dpr={[1, 2]}
			camera={{ fov: 40, near: 0.1, far: 120, position: [0, 7, 17] }}
			gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
		>
			<color attach="background" args={["#120c09"]} />
			<fog attach="fog" args={["#120c09", 18, 42]} />
			<hemisphereLight args={["#ffe6c7", "#2a1a10", 0.8]} />
			<spotLight
				position={[2, 15, 9]}
				angle={0.62}
				penumbra={0.65}
				intensity={420}
				color="#ffe0b8"
				castShadow
				shadow-mapSize={[2048, 2048]}
				shadow-bias={-0.0004}
			/>
			<pointLight position={[-7, 5, 6]} intensity={30} color="#8fb3ff" />
			<Rig focus={focus} />
			<Table />
			<Board release={releaseAt} />

			{grid &&
				grid.map( ( v, i ) =>
				{
					if ( !v ) return null;
					const c = i % COLS;
					const r = Math.floor( i / COLS );
					const isDrop = state.drop && state.drop.col === c && state.drop.row === r;
					const fallAt = isDrop ? falls.current[dropSeq] : null;
					const inLine = showLine && lineSet.has( c + "," + r );
					return <Token key={c + "," + r + ":" + state.set} c={c} r={r} seat={v - 1} fallAt={fallAt} inLine={inLine} dim={showLine && !inLine} />;
				} )}

			{playing && state.step === "aim" && <HeldToken seat={seat} col={cols} />}
			{myTurn && <ColumnGlow col={cols} seat={seat} full={colFull} />}
			{showLine && state.line && <WinBar key={state.set + ":" + state.round} line={state.line} seat={state.players.find( ( p ) => p.id === state.roundWinner )?.seat ?? 0} />}
			{releaseAt && releaseGrid.current && <Released key={releaseAt} grid={releaseGrid.current} startAt={releaseAt} />}

			{/* zone de visée devant le plateau */}
			<mesh
				position={[0, BASE_Y + ROWS / 2 + 0.6, 0.45]}
				visible={false}
				onPointerMove={( e ) =>
				{
					if ( !myTurn ) return;
					e.stopPropagation();
					const c = pick( e );
					if ( c !== null ) onHover( c );
				}}
				onClick={( e ) =>
				{
					if ( !myTurn ) return;
					e.stopPropagation();
					const c = pick( e );
					if ( c !== null ) onPlay( c );
				}}
			>
				<planeGeometry args={[BW, ROWS + 2.6]} />
			</mesh>

			{bySeat.map(
				( p, s ) =>
					p && (
						<Player
							key={p.id}
							p={p}
							side={s === 0 ? -1 : 1}
							active={playing && state.turn === p.id}
							won={( state.phase === "end" && state.winner === p.id ) || ( state.step === "won" && state.roundWinner === p.id )}
							score={p.roundWins}
							target={need}
						/>
					),
			)}
			{state.phase === "end" && state.winner && (
				<Sparkles count={110} scale={[16, 8, 6]} position={[0, 4, 1]} size={7} speed={0.5} color={COLORS[state.players.find( ( p ) => p.id === state.winner )?.seat ?? 0].hex} />
			)}
		</Canvas>
	);
}

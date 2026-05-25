import { useEffect, useMemo, useState, useRef, Suspense } from "react";
import * as THREE from "three";
import {
  useLoader,
  Canvas,
  useFrame,
  type ThreeEvent,
} from "@react-three/fiber";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import {
  PerspectiveCamera,
  Text,
  useTexture,
  Environment,
} from "@react-three/drei";
import {
  CanvasTexture,
  DoubleSide,
  MathUtils,
  RepeatWrapping,
  Vector3,
  type Mesh,
  type MeshBasicMaterial,
  type Texture,
  type PerspectiveCamera as PerspectiveCameraType,
} from "three";

import "./App.css";
const FONT_URL = "/fonts/NotoSansJP-Bold.ttf";
type SportType =
  | "volleyball"
  | "soccer"
  | "basketball"
  | "boccia"
  | "wrestling"
  | "golf"
  | "softball"
  | "darts";

// モデルのパスリスト
const OBJ_MODELS = [
  "/models/BasketBall.obj",
  "/models/golf.obj",
  "/models/volley.obj",
  "/models/soccer.obj",
];

const SPORTS: { id: SportType; label: string }[] = [
  { id: "softball", label: "ソフトボール" },
  { id: "volleyball", label: "バレーボール" },
  { id: "soccer", label: "サッカー" },
  { id: "basketball", label: "バスケットボール" },
  { id: "darts", label: "ダーツ" },
  { id: "boccia", label: "ボッチャ" },
  { id: "wrestling", label: "アムレス" },
  //{ id: "golf", label: "パターゴルフ" },
];

const RING_RADIUS = 3.5;
const RING_Y = 1;

const ICON_URL_BY_SPORT: Record<SportType, string> = {
  softball: new URL("./assets/softball.png", import.meta.url).toString(),
  volleyball: new URL("./assets/volleyball.png", import.meta.url).toString(),
  soccer: new URL("./assets/soccerball.png", import.meta.url).toString(),
  basketball: new URL("./assets/basketball.png", import.meta.url).toString(),
  darts: new URL("./assets/darts.png", import.meta.url).toString(),
  boccia: new URL("./assets/bottya.png", import.meta.url).toString(),
  wrestling: new URL("./assets/udezumou.jpg", import.meta.url).toString(),
  golf: new URL("./assets/golfball.png", import.meta.url).toString(),
};

function CenterModel({ url, isActive }: { url: string; isActive: boolean }) {
  const meshRef = useRef<THREE.Group>(null);
  const mtlUrl = url.replace(".obj", ".mtl");

  const materials = useLoader(MTLLoader, mtlUrl);
  const obj = useLoader(OBJLoader, url, (loader) => {
    materials.preload();
    loader.setMaterials(materials);
  });

  const normalizedScene = useMemo(() => {
    const clone = obj.clone();
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scaleFactor = 1.0 / (maxDim || 1);
    clone.scale.setScalar(scaleFactor);

    const center = new THREE.Vector3();
    box.getCenter(center);
    clone.position.x -= center.x * scaleFactor;
    clone.position.y -= center.y * scaleFactor;
    clone.position.z -= center.z * scaleFactor;

    clone.traverse((child: THREE.Object3D) => {
      if ((child as Mesh).isMesh) {
        const m = child as Mesh;
        m.castShadow = true;
        // MTLは通常 MeshPhongMaterial を生成する
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mat) => {
          mat.side = DoubleSide;
          if (
            mat instanceof THREE.MeshPhongMaterial ||
            mat instanceof THREE.MeshStandardMaterial
          ) {
            if (mat.color) {
              mat.emissive = mat.color;
              mat.emissiveIntensity = 0.2;
            }
          }
        });
      }
    });
    return clone;
  }, [obj]);

  useFrame((state, delta) => {
    if (meshRef.current) {
      // 常に回転はさせておく（アクティブになった瞬間回っているように）
      meshRef.current.rotation.y += delta * 0.8;

      // スムーズなサイズ切り替え (isActiveなら1, そうでなければ0へ)
      const targetScale = isActive ? 1 : 0;
      meshRef.current.scale.x = THREE.MathUtils.damp(
        meshRef.current.scale.x,
        targetScale,
        8,
        delta,
      );
      meshRef.current.scale.y = THREE.MathUtils.damp(
        meshRef.current.scale.y,
        targetScale,
        8,
        delta,
      );
      meshRef.current.scale.z = THREE.MathUtils.damp(
        meshRef.current.scale.z,
        targetScale,
        8,
        delta,
      );

      // アクティブな時だけ上下に揺らす
      if (isActive) {
        meshRef.current.position.y =
          RING_Y + Math.sin(state.clock.elapsedTime * 1.5) * 0.1;
      }
    }
  });

  return (
    // visible={isActive || scale > 0.01} のようにすると完全に消えるまで描画される
    <group ref={meshRef} position={[0, RING_Y, 0]}>
      {/* primitive is a valid R3F component */}
      <primitive object={normalizedScene} />
    </group>
  );
}

function SportIconPillar({ texture }: { texture: Texture }) {
  const size = 0.48; // 正方形
  const half = size / 2;
  const y = -0.8; // ラベル下（ワールドだと地面ギリギリに来る想定）

  const materialProps = {
    map: texture,
    transparent: true,
    toneMapped: false as const,
    side: DoubleSide,
  };

  return (
    <group position={[0, y, 0]} raycast={() => null}>
      {/* 前 */}
      <mesh position={[0, 0, half]} raycast={() => null}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial {...materialProps} />
      </mesh>
      {/* 後 */}
      <mesh
        position={[0, 0, -half]}
        rotation={[0, Math.PI, 0]}
        raycast={() => null}
      >
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial {...materialProps} />
      </mesh>
      {/* 右 */}
      <mesh
        position={[half, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
        raycast={() => null}
      >
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial {...materialProps} />
      </mesh>
      {/* 左 */}
      <mesh
        position={[-half, 0, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        raycast={() => null}
      >
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial {...materialProps} />
      </mesh>
    </group>
  );
}
function GroundRing() {
  // 3等分の色（例：前の試合、現在、次の試合をイメージした3色など）
  const PALETTE = [
    "#1a60d7",
    "#eca643",
    "#f84343",
    "#1ad753",
    "#d71a7c",
    "#1ad7c9",
  ];
  const [randomColors] = useState(() => {
    const shuffled = [...PALETTE].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
  });

  const y = -RING_Y + 0.01; // 地面より少しだけ上に浮かせる

  return (
    <group position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {randomColors.map((color, i) => (
        <mesh key={i} rotation={[0, 0, (i * Math.PI * 2) / 3]}>
          {/* args: [内径, 外径, 分割数, 1, 開始角度, 扇形の角度] */}
          <ringGeometry args={[0.32, 0.35, 32, 1, 0, (Math.PI * 2) / 3]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.8}
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* 全体を縁取る細い白線（入れるとデザインが締まります） */}
      <mesh>
        <ringGeometry args={[0.35, 0.36, 64]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.3}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}
type ApiTeam = {
  id: string | null; //識別id
  name: string[]; //チーム表示名配列["2I","2年電子情報工学科"]
  is_fixed: boolean; //チーム確定フラグ
  score: number; //特典
  src_info: null | { match_id: string; type: "winner" | "loser" }; //直前試合の情報id（勝者/敗者）
};

type ApiMatch = {
  match_id: string; //識別id
  display_number: string; //試合表示名
  start_time: string; //試合開始予定日時（ISO8601）
  court: string; //A,B,""
  is_finished: boolean; //試合終了フラグ
  teams: ApiTeam[];
  result: {
    winner_id: string | null; //勝者チームid
    loser_id: string[]; //敗者チームid
    win_type: "normal" | "bye";
  };
  next_matches: { winner: string | null; loser: string | null };
};
type ApiSportSnapshot = {
  sport_type: SportType;
  json_generated_at: string;
  matches: ApiMatch[];
};

type FocusTarget = {
  pos: [number, number, number];
  normal: [number, number, number];
  sport: SportType;
};

type MatchSummary = {
  title: string;
  timeText: string;
  courtText: string;
  versusText: string;
  resultText?: string;
};

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function teamDisplayName(team: ApiTeam) {
  return team.name[0] ?? "";
}

function versusText(match: ApiMatch | null) {
  if (!match) return null;
  const [t1, t2] = match.teams;
  const leftRaw = t1 ? teamDisplayName(t1).trim() : "";
  const rightRaw = t2 ? teamDisplayName(t2).trim() : "";
  if (!leftRaw && !rightRaw) return null;
  const left = leftRaw || "—";
  const right = rightRaw || "—";
  return `${left} VS ${right}`;
}

function summarizeMatch(match: ApiMatch, title: string): MatchSummary {
  const [t1, t2] = match.teams;
  const vs = [t1, t2]
    .filter(Boolean)
    .map((t) => teamDisplayName(t))
    .join(" vs ");

  const courtText = match.court ? `コート ${match.court}` : "";

  let resultText: string | undefined;
  if (match.is_finished && match.result.winner_id) {
    const winnerTeam = match.teams.find((t) => t.id === match.result.winner_id);
    if (winnerTeam) {
      resultText = `勝者: ${teamDisplayName(winnerTeam)}`;
    }
  }

  return {
    title,
    timeText: formatTime(match.start_time),
    courtText,
    versusText: vs,
    resultText,
  };
}

function pickPrevNowNext(matches: ApiMatch[]) {
  const now = Date.now();
  const parsed = matches
    .map((m) => ({ m, ts: new Date(m.start_time).getTime() }))
    .filter((x) => !Number.isNaN(x.ts));

  const finished = parsed.filter((x) => x.m.is_finished);
  const notFinished = parsed.filter((x) => !x.m.is_finished);

  const prev = finished.sort((a, b) => b.ts - a.ts)[0]?.m ?? null;
  const upcoming = notFinished
    .filter((x) => x.ts > now)
    .sort((a, b) => a.ts - b.ts);

  const next = upcoming[0]?.m ?? null;
  const next2 = upcoming[1]?.m ?? null;

  const nowMatch =
    notFinished.filter((x) => x.ts <= now).sort((a, b) => b.ts - a.ts)[0]?.m ??
    null;

  return { prev, now: nowMatch, next, next2 };
}

function buildMockSnapshot(sport: SportType): ApiSportSnapshot {
  const d = new Date();
  const isoNow = d.toISOString();
  const minusMinutes = (min: number) =>
    new Date(Date.now() - min * 60_000).toISOString();
  const plusMinutes = (min: number) =>
    new Date(Date.now() + min * 60_000).toISOString();

  const court = ((): string => {
    if (
      sport === "boccia" ||
      sport === "wrestling" ||
      sport === "golf" ||
      sport === "darts"
    )
      return "";
    return "A";
  })();

  const mkTeam = (
    id: string,
    short: string,
    long?: string,
    score = 0,
  ): ApiTeam => ({
    id,
    name: long ? [short, long] : [short],
    is_fixed: true,
    score,
    src_info: null,
  });

  const t1 = mkTeam("4I", "4I", "4年電子情報工学科", 2);
  const t2 = mkTeam("5A", "5A", "5年建築学科", 1);
  const t3 = mkTeam("2E", "2E", "2年電気工学科", 0);
  const t4 = mkTeam("3C", "3C", "3年環境都市工学科", 0);

  const prev: ApiMatch = {
    match_id: `${sport.slice(0, 2)}01`,
    display_number: "1",
    start_time: minusMinutes(50),
    court,
    is_finished: true,
    teams: [t1, t2],
    result: { winner_id: "4I", loser_id: ["5A"], win_type: "normal" },
    next_matches: { winner: null, loser: null },
  };

  const current: ApiMatch = {
    match_id: `${sport.slice(0, 2)}02`,
    display_number: "2",
    start_time: minusMinutes(5),
    court,
    is_finished: false,
    teams: [t3, t4],
    result: { winner_id: null, loser_id: [], win_type: "normal" },
    next_matches: { winner: null, loser: null },
  };

  const next: ApiMatch = {
    match_id: `${sport.slice(0, 2)}03`,
    display_number: "3",
    start_time: plusMinutes(35),
    court,
    is_finished: false,
    teams: [
      {
        id: null,
        name: ["2の勝者"],
        is_fixed: false,
        score: 0,
        src_info: { match_id: current.match_id, type: "winner" },
      },
      {
        id: null,
        name: ["1の勝者"],
        is_fixed: false,
        score: 0,
        src_info: { match_id: prev.match_id, type: "winner" },
      },
    ],
    result: { winner_id: null, loser_id: [], win_type: "normal" },
    next_matches: { winner: null, loser: null },
  };

  return {
    sport_type: sport,
    json_generated_at: isoNow,
    matches: [prev, current, next],
  };
}

const SNAPSHOT_URL: string | undefined = import.meta.env.VITE_SNAPSHOT_URL;

function buildSnapshotUrl(sport: SportType) {
  if (!SNAPSHOT_URL) return null;

  const url = new URL(SNAPSHOT_URL, window.location.origin);
  url.searchParams.set("sport", sport);
  return url.toString();
}

async function fetchSportSnapshot(sport: SportType, signal: AbortSignal) {
  const url = buildSnapshotUrl(sport);
  if (!url) return null;

  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`snapshot fetch failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as ApiSportSnapshot;
  return data;
}

function isAbortError(e: unknown) {
  if (e instanceof DOMException && e.name === "AbortError") return true;
  if (typeof e === "object" && e !== null && "name" in e) {
    return (e as { name?: unknown }).name === "AbortError";
  }
  return false;
}

function TextRing({
  onSelect,
  labelBySport,
}: {
  onSelect: (t: FocusTarget) => void;
  labelBySport: Partial<Record<SportType, string>>;
}) {
  const textColor = "#cfcfcf";
  const textures = useTexture(ICON_URL_BY_SPORT) as unknown as Record<
    SportType,
    Texture
  >;

  return (
    <group>
      {SPORTS.map((sport, i) => {
        const fullLabel = labelBySport[sport.id] ?? sport.label;
        // 改行で分割する（[0]が競技名、[1]が対戦カード）
        const [sportName, vsInfo] = fullLabel.split("\n");

        const n = SPORTS.length;
        const angle = (i / n) * Math.PI * 2;
        const x = Math.cos(angle) * RING_RADIUS;
        const z = Math.sin(angle) * RING_RADIUS;
        const rotationY = -angle + Math.PI * 2.5;

        const normal: FocusTarget["normal"] = [
          Math.cos(angle),
          0,
          Math.sin(angle),
        ];

        const select = (e?: ThreeEvent<PointerEvent>) => {
          e?.stopPropagation();
          onSelect({ pos: [x, RING_Y, z], normal, sport: sport.id });
        };

        return (
          <group
            key={sport.id}
            position={[x, RING_Y, z]}
            rotation={[0, rotationY, 0]}
          >
            {/* クリック判定用の透明な板（少し大きめに設定） */}
            <mesh
              onPointerDown={select}
              // 少し下にずらすことで、上のテキストから下のアイコンまでをカバーする
              position={[0, -0.3, 0]}
            >
              {/* args={[横幅, 高さ]} を大きく設定 */}
              <planeGeometry args={[2.0, 1.8]} />
              <meshBasicMaterial
                transparent
                opacity={0} // 0なら見えません。0.1にするとデバッグ用に薄く見えます
                depthWrite={false}
              />
            </mesh>

            {/* 上の文字：競技名（大きく） */}
            <Text
              fontSize={0.22} // サイズ大きめ
              font={FONT_URL}
              color={textColor}
              anchorX="center"
              anchorY="bottom" // 下端を基準にする
              position={[0, 0.05, 0]} // 少し上にずらす
              onPointerDown={select}
            >
              {sportName}
            </Text>

            {/* 下の文字：対戦カード（小さく） */}
            {vsInfo && (
              <Text
                fontSize={0.14} // サイズ小さめ
                color={textColor}
                anchorX="center"
                anchorY="top" // 上端を基準にする
                position={[0, -0.05, 0]} // 少し下にずらす
                onPointerDown={select}
              >
                {vsInfo}
              </Text>
            )}

            <SportIconPillar texture={textures[sport.id]} />
            <GroundRing />
          </group>
        );
      })}
    </group>
  );
}

function FallingSpheres() {
  const count = 36;

  const params = useMemo(() => {
    return Array.from({ length: count }, () => {
      const x = MathUtils.randFloatSpread(18);
      const z = MathUtils.randFloatSpread(18);
      const y = MathUtils.randFloat(5.5, 12);
      const r = MathUtils.randFloat(0.08, 0.18);
      const speed = MathUtils.randFloat(0.9, 2.4);
      const h = MathUtils.randFloat(0, 1);
      const s = MathUtils.randFloat(0.75, 0.95);
      const l = MathUtils.randFloat(0.55, 0.65);
      return { x, y, z, r, speed, h, s, l };
    });
  }, []);

  const meshesRef = useRef<Array<Mesh | null>>([]);

  useFrame((_, delta) => {
    for (let i = 0; i < params.length; i++) {
      const mesh = meshesRef.current[i];
      if (!mesh) continue;

      mesh.position.y -= params[i].speed * delta;
      mesh.rotation.y += delta * 0.3;
      mesh.rotation.x += delta * 0.2;

      if (mesh.position.y < -0.6) {
        mesh.position.y = MathUtils.randFloat(6.5, 12);
        mesh.position.x = MathUtils.randFloatSpread(18);
        mesh.position.z = MathUtils.randFloatSpread(18);

        const material = mesh.material as MeshBasicMaterial;
        const h = MathUtils.randFloat(0, 1);
        const s = MathUtils.randFloat(0.75, 0.95);
        const l = MathUtils.randFloat(0.55, 0.65);
        material.color.setHSL(h, s, l);
      }
    }
  });

  return (
    <group>
      {params.map((p, i) => (
        <mesh
          key={i}
          ref={(m) => {
            meshesRef.current[i] = m;
          }}
          position={[p.x, p.y, p.z]}
          raycast={() => null}
          castShadow={false}
          receiveShadow={false}
        >
          <sphereGeometry args={[p.r, 16, 16]} />
          <meshBasicMaterial
            color={`hsl(${Math.round(p.h * 360)} ${Math.round(p.s * 100)}% ${Math.round(p.l * 100)}%)`}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function FocusOverlay({
  sportLabel,
  winnerText,
  prev,
  now,
  next,
  next2,
}: {
  sportLabel: string;
  winnerText: string | null;
  prev: MatchSummary | null;
  now: MatchSummary | null;
  next: MatchSummary | null;
  next2: MatchSummary | null;
}) {
  const center = now ?? next;
  const bottom = now ? next : next2;

  const renderBlock = (title: string, m: MatchSummary | null) => {
    if (!m) {
      return (
        <div className="focusOverlay__block">
          <div className="focusOverlay__slotTitle">{title}</div>
          <div className="focusOverlay__empty">なし</div>
        </div>
      );
    }
    return (
      <div className="focusOverlay__block">
        <div className="focusOverlay__slotTitle">{title}</div>
        <div className="focusOverlay__vs">{m.versusText}</div>
        <div className="focusOverlay__row">
          <span className="focusOverlay__time">{m.timeText}</span>
          {m.courtText ? (
            <span className="focusOverlay__meta">{m.courtText}</span>
          ) : null}
        </div>
        {m.resultText ? (
          <div className="focusOverlay__result">{m.resultText}</div>
        ) : null}
      </div>
    );
  };

  return (
    <div
      className={`focusOverlay${winnerText ? " focusOverlay--finished" : ""}`}
    >
      <div className="focusOverlay__sport">{sportLabel}</div>
      {winnerText ? (
        <div className="focusOverlay__winnerBadge">
          <span className="focusOverlay__winnerLabel">勝利</span>
          <span className="focusOverlay__winnerText">{winnerText}</span>
        </div>
      ) : null}
      <div className="focusOverlay__panel">
        <div className="focusOverlay__panel-section">
          {renderBlock("前の試合", prev)}
        </div>
        <div className="focusOverlay__panel-section">
          {renderBlock(now ? "現在" : "次の試合", center)}
        </div>
        <div className="focusOverlay__panel-section">
          {renderBlock("次の試合", bottom)}
        </div>
      </div>
    </div>
  );
}

function Ground() {
  const radius = 4.2;
  const segments = 96;
  const thickness = 0.22;

  const gridTex = useMemo(() => {
    if (typeof document === "undefined") return null;
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.clearRect(0, 0, size, size);

    const cell = 32;
    const thickEvery = 4;

    for (let x = 0; x <= size; x += cell) {
      const isThick = (x / cell) % thickEvery === 0;
      ctx.strokeStyle = isThick
        ? "rgba(255,255,255,0.38)"
        : "rgba(255,255,255,0.18)";
      ctx.lineWidth = isThick ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, size);
      ctx.stroke();
    }
    for (let y = 0; y <= size; y += cell) {
      const isThick = (y / cell) % thickEvery === 0;
      ctx.strokeStyle = isThick
        ? "rgba(255,255,255,0.38)"
        : "rgba(255,255,255,0.18)";
      ctx.lineWidth = isThick ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(size, y + 0.5);
      ctx.stroke();
    }

    const tex = new CanvasTexture(canvas);
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.repeat.set(2.5, 2.5);
    tex.needsUpdate = true;
    return tex;
  }, []);

  return (
    <group>
      {/* 側面（オープンエンド円柱） */}
      <mesh position={[0, -thickness / 2, 0]} raycast={() => null}>
        <cylinderGeometry
          args={[radius, radius, thickness, segments, 1, true]}
        />
        <meshStandardMaterial
          color="#3b3b3b"
          roughness={0.95}
          metalness={0.05}
        />
      </mesh>
      {/* 上面：ベースの色 */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.001, 0]}
        raycast={() => null}
      >
        <circleGeometry args={[radius, segments]} />
        {/* meshBasicMaterial にするとライトの影響を受けず、指定した色がそのまま出ます */}
        <meshBasicMaterial color="#373636" />
      </mesh>

      {/* 上面：重ねる格子 */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.002, 0]}
        raycast={() => null}
      >
        <circleGeometry args={[radius, segments]} />
        <meshBasicMaterial
          map={gridTex ?? undefined}
          color="#377ef9"
          transparent={true} // 透明を有効にする
          depthWrite={false} // 重なりのチラつき（Zファイティング）を防止
        />
      </mesh>

      {/* 底面（暗めでふさぐ） */}
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, -thickness - 0.001, 0]}
        raycast={() => null}
      >
        <circleGeometry args={[radius, segments]} />
        <meshStandardMaterial color="#7b7b7b" roughness={1} metalness={0} />
      </mesh>
    </group>
  );
}
function OrbitCamera({ focus }: { focus: FocusTarget | null }) {
  const camRef = useRef<PerspectiveCameraType>(null!);
  const tRef = useRef(0);

  const desiredPos = useRef(new Vector3());
  const desiredTarget = useRef(new Vector3());

  useFrame((_, delta) => {
    const cam = camRef.current;
    if (focus) {
      const p = desiredTarget.current.set(...focus.pos);
      const n = new Vector3(...focus.normal);

      desiredPos.current
        .copy(p)
        .add(n.multiplyScalar(2.2)) // 法線方向に距離を取る
        .add(new Vector3(0, 1.0, 0)); // 少し上から見る
      desiredTarget.current.set(focus.pos[0], focus.pos[1] + 0.2, focus.pos[2]);
    } else {
      tRef.current += delta * 0.3; // 回転速度
      const camRadius = 7.0;
      const speed = 0.35;
      const angle = tRef.current * speed;

      const baseY = 2.5; // 基本の高さ
      const amplitude = 1.9; // 上下の振幅
      const frequency = 0.6; // 上下の速さ

      const camY = baseY + Math.sin(tRef.current * frequency) * amplitude;

      desiredPos.current.set(
        Math.cos(angle) * camRadius,
        camY,
        Math.sin(angle) * camRadius,
      );
      desiredTarget.current.set(0, 1.2, 0);
    }
    const lambda = 6;
    cam.position.x = MathUtils.damp(
      cam.position.x,
      desiredPos.current.x,
      lambda,
      delta,
    );
    cam.position.y = MathUtils.damp(
      cam.position.y,
      desiredPos.current.y,
      lambda,
      delta,
    );
    cam.position.z = MathUtils.damp(
      cam.position.z,
      desiredPos.current.z,
      lambda,
      delta,
    );

    camRef.current.lookAt(desiredTarget.current);
  });
  return (
    <PerspectiveCamera
      ref={camRef}
      makeDefault
      fov={50}
      near={0.1}
      far={100}
      position={[0, 1.5, 10]}
    />
  );
}
function GroundGlow() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
      <ringGeometry args={[4.5, 4.8, 64]} />
      <meshBasicMaterial
        color="#377ef9"
        transparent
        opacity={0.2}
        side={DoubleSide}
      />
    </mesh>
  );
}

export default function App() {
  const [focus, setFocus] = useState<FocusTarget | null>(null);
  const [focusSequence, setFocusSequence] = useState(0);
  const focusTimerRef = useRef<number | null>(null);
  const ignoreMissUntilRef = useRef(0);

  const [modelIndex, setModelIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setModelIndex((prev) => (prev + 1) % OBJ_MODELS.length);
    }, 5000); // 5秒ごとに切り替え
    return () => clearInterval(timer);
  }, []);

  const [snapshotsBySport, setSnapshotsBySport] = useState<
    Partial<Record<SportType, ApiSportSnapshot>>
  >({});
  const snapshotsBySportRef = useRef(snapshotsBySport);

  useEffect(() => {
    snapshotsBySportRef.current = snapshotsBySport;
  }, [snapshotsBySport]);

  const finishedMapBySportRef = useRef<
    Partial<Record<SportType, Map<string, boolean>>>
  >({});

  const focusedSport = focus?.sport ?? null;
  const focusedSportLabel = focusedSport
    ? (SPORTS.find((s) => s.id === focusedSport)?.label ?? focusedSport)
    : "";

  const activeSnapshot = useMemo(() => {
    if (!focusedSport) return null;
    // only use actual fetched snapshot; do not fall back to mock
    return snapshotsBySport[focusedSport] ?? null;
  }, [focusedSport, snapshotsBySport]);

  const focusPanel = useMemo(() => {
    if (!activeSnapshot)
      return { prev: null, now: null, next: null, next2: null };
    const { prev, now, next, next2 } = pickPrevNowNext(activeSnapshot.matches);
    return {
      prev: prev ? summarizeMatch(prev, "前の試合") : null,
      now: now ? summarizeMatch(now, "現在") : null,
      next: next ? summarizeMatch(next, "次の試合") : null,
      next2: next2 ? summarizeMatch(next2, "次の試合") : null,
    };
  }, [activeSnapshot]);

  const ringLabelBySport = useMemo(() => {
    const map: Partial<Record<SportType, string>> = {};
    for (const s of SPORTS) {
      const snapshot = snapshotsBySport[s.id] ?? null;
      if (!snapshot) continue; // skip sports with no real data
      const { now, next } = pickPrevNowNext(snapshot.matches);
      const primary = now ?? next;
      const vs = versusText(primary);
      map[s.id] = vs ? `${s.label}\n${vs}` : s.label;
    }
    return map;
  }, [snapshotsBySport]);

  const focusTargetForSport = useMemo(() => {
    const n = SPORTS.length;
    const targets: Partial<Record<SportType, FocusTarget>> = {};
    for (const [i, sport] of SPORTS.entries()) {
      const angle = (i / n) * Math.PI * 2;
      const x = Math.cos(angle) * RING_RADIUS;
      const z = Math.sin(angle) * RING_RADIUS;
      targets[sport.id] = {
        sport: sport.id,
        pos: [x, RING_Y, z],
        normal: [Math.cos(angle), 0, Math.sin(angle)],
      };
    }
    return targets;
  }, []);

  function triggerFocus(next: FocusTarget) {
    // if we don't have real snapshot data for this sport, do not focus
    const hasData = Boolean(snapshotsBySportRef.current[next.sport]);
    if (!hasData) return;

    ignoreMissUntilRef.current = Date.now() + 300;
    setFocus(next);
    setFocusSequence((prev) => prev + 1);
    if (focusTimerRef.current !== null) {
      window.clearTimeout(focusTimerRef.current);
    }
    focusTimerRef.current = window.setTimeout(() => setFocus(null), 30000);
  }

  function focusSportById(sport: SportType) {
    const target = focusTargetForSport[sport];
    if (target) triggerFocus(target);
  }

  function markMatchFinished(sport: SportType, matchId: string) {
    const current =
      snapshotsBySportRef.current[sport] ?? buildMockSnapshot(sport);
    const matchExists = current.matches.some(
      (match) => match.match_id === matchId,
    );

    if (!matchExists) {
      return false;
    }

    setSnapshotsBySport((prev) => {
      const latest = prev[sport] ?? current;
      return {
        ...prev,
        [sport]: {
          ...latest,
          matches: latest.matches.map((match) =>
            match.match_id === matchId
              ? {
                  ...match,
                  is_finished: true,
                  result: {
                    ...match.result,
                    winner_id:
                      match.result.winner_id ?? match.teams[0]?.id ?? null,
                  },
                }
              : match,
          ),
        },
      };
    });

    focusSportById(sport);
    return true;
  }

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    type DebugApi = {
      focusSport: (sport: SportType) => void;
      clearFocus: () => void;
      finishMatch: (sport: SportType, matchId: string) => void;
      setMockSnapshot: (sport: SportType) => void;
    };

    const debugApi: DebugApi = {
      focusSport: (sport) => {
        focusSportById(sport);
      },
      clearFocus: () => {
        setFocus(null);
      },
      finishMatch: (sport, matchId) => {
        markMatchFinished(sport, matchId);
      },
      setMockSnapshot: (sport) => {
        setSnapshotsBySport((prev) => ({
          ...prev,
          [sport]: buildMockSnapshot(sport),
        }));
      },
    };

    (window as Window & { __kyuugiDebug?: DebugApi }).__kyuugiDebug = debugApi;

    return () => {
      delete (window as Window & { __kyuugiDebug?: DebugApi }).__kyuugiDebug;
    };
  }, [focusTargetForSport]);

  useEffect(() => {
    if (!SNAPSHOT_URL) return;

    const ac = new AbortController();
    let intervalId: number | null = null;

    const tick = async () => {
      const results = await Promise.all(
        SPORTS.map(async (s) => {
          try {
            const snapshot = await fetchSportSnapshot(s.id, ac.signal);
            return { sport: s.id, snapshot } as const;
          } catch (e) {
            if (!isAbortError(e)) console.error(e);
            return { sport: s.id, snapshot: null } as const;
          }
        }),
      );

      if (ac.signal.aborted) return;

      const nextBySport: Partial<Record<SportType, ApiSportSnapshot>> = {};
      const finishedTransitions: SportType[] = [];

      for (const { sport, snapshot } of results) {
        if (!snapshot) continue;
        nextBySport[sport] = snapshot;

        const prevMap =
          finishedMapBySportRef.current[sport] ?? new Map<string, boolean>();
        for (const m of snapshot.matches) {
          const prevFinished = prevMap.get(m.match_id);
          if (prevFinished === false && m.is_finished === true) {
            finishedTransitions.push(sport);
          }
          prevMap.set(m.match_id, m.is_finished);
        }
        finishedMapBySportRef.current[sport] = prevMap;
      }

      setSnapshotsBySport((prev) => ({ ...prev, ...nextBySport }));

      const focusSport = finishedTransitions[0] ?? null;
      if (focusSport) {
        focusSportById(focusSport);
      }
    };

    void tick();
    intervalId = window.setInterval(() => {
      void tick();
    }, 30_000);

    return () => {
      ac.abort();
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, [focusTargetForSport]);
  return (
    <div className="app">
      {focusedSport ? (
        <FocusOverlay
          key={`${focusedSport}-${focusSequence}`}
          sportLabel={focusedSportLabel}
          winnerText={
            focusPanel.prev?.resultText ??
            focusPanel.now?.resultText ??
            focusPanel.next?.resultText ??
            null
          }
          prev={focusPanel.prev}
          now={focusPanel.now}
          next={focusPanel.next}
          next2={focusPanel.next2}
        />
      ) : null}
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        onPointerMissed={() => {
          if (Date.now() < ignoreMissUntilRef.current) return;
          setFocus(null);
        }}
      >
        <Suspense fallback={null}>
          <Environment preset="city" />
          {/* mapを使って全モデルを同時にマウントする */}
          {OBJ_MODELS.map((url, index) => (
            <CenterModel key={url} url={url} isActive={index === modelIndex} />
          ))}
        </Suspense>
        {/* 環境光：全体をうっすら明るくする */}
        <ambientLight intensity={1.5} />
        {/* 平行光：方向性のあるライト。立体感が出る */}
        <directionalLight intensity={1.1} position={[3, 6, 4]} />
        <pointLight position={[-5, 5, -5]} intensity={1.5} color="#ffffff" />
        <pointLight position={[0, -2, 0]} intensity={0.8} color="#ffffff" />
        <spotLight
          position={[0, 5, 0]}
          intensity={3}
          angle={0.3}
          penumbra={1}
        />
        {/* 背景演出：上から落ちるカラフル球体 */}
        <FallingSpheres />
        {/* カメラ */}
        <OrbitCamera focus={focus} />
        {/* 中央の回転するボール */}
        <Suspense fallback={null}>
          <CenterModel url={OBJ_MODELS[modelIndex]} isActive={true} />
        </Suspense>
        {/* 3Dラベル */}
        <TextRing onSelect={triggerFocus} labelBySport={ringLabelBySport} />

        {/* 底面 */}
        <Ground />
        <GroundGlow />
      </Canvas>
    </div>
  );
}

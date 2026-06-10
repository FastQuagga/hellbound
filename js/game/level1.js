// Уровень 1 — ТЕХБАЗА «ГЕФЕСТ-1». Данные уровня по контракту docs/architecture.md §14.
// Сетка 64×64: walls — стены/двери/секреты/выход, zones — пол/потолок/свет на клетку.
// Прогрессия: техбаза -> двор -> синий ключ -> машинный зал -> кислота -> жёлтый ключ -> ад -> барон -> выход.

export const LEVEL1 = {
  name: 'ТЕХБАЗА «ГЕФЕСТ-1»',
  w: 64, h: 64,

  walls: [
    '################################################################',
    '#KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK##################',
    '#KAAAAAAAAAAAAAAAAAAA........................K##################',
    '#KAA.............AAAA........................K#####...##...#####',
    '#KAA.............A...........................K#####...##...#####',
    '#KAA...............................FFF.......K##tttPDPttPDPttt##',
    '#KAE...............................FFF.......K##t............t##',
    '#KAA.............A...........................K##t............t##',
    '#KAA.............A........FFF................K..P............t##',
    '#KAA.............AAAA.....FFF................K..D............t##',
    '#KAAAAAAAAAAAAAAAAAAA........................K..P............t##',
    '#K...........................................K##t............t##',
    '#K...........................................K##t............t##',
    '#K...........................................K##tttttPDPtttttt##',
    '#K...........................................K########..########',
    '#KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK...KKKKKKKK########..########',
    '##################################K...K###############..########',
    '##################################K...K###############..########',
    '##################################K...K########MMMMMMM..MMMMMM##',
    '###########################tCCCCCCCPYPCCCCCCCt#M.............M##',
    '###########################t.................t#M.............M##',
    '###########################t.................t#M.............M##',
    '###########################t.................t#M.............M##',
    '###########################t.................t#M.............M##',
    '###########################t....MM.....MM....t#M.............M.#',
    '#####################MMMMMMM....MM.....MM....................V.#',
    '#####################M.....M.................................M.#',
    '#####################M.....P.................t#M.............M##',
    '#####################M.....R.................t#M.............M##',
    '#####################M.....P.................t#M.............M##',
    '#####################M.....M.................t#M.............M##',
    '#####################MMMMMMM.................t#M.............M##',
    '###########################tttttttt...tttttttt#M.............M##',
    '#########...#######################...#########MMMMMMMMMMMMMMM##',
    '#########...#############OOOO..OOOOPBPO..OOOOOOO################',
    '#########PDP#############O.....................O################',
    '######..............#####O.....................O################',
    '######..............#####O.....................O################',
    '######..............#####O.....................O################',
    '##...#..............#####O......................O###############',
    '##...#..........................................O###############',
    '##...S.........................................O################',
    '##...#..............#####O.....................O################',
    '##...#..............#####O.....................O################',
    '######..............#####O.....................O################',
    '######..............#####O.....................O################',
    '######..............#####O.....................O################',
    '#############PDP#########OOOOOOOO...OOOOOOOOOOOO################',
    '#############...#################...############################',
    '#############...#################PDP############################',
    '#########################...................####################',
    '#########################..............XXX..####################',
    '#########################.......X......XXX..####################',
    '###...........###########...XXX........XXX..####################',
    '###...........###########...XXX.......X.....####################',
    '###...........P#########P...XXX.............####################',
    '###...........D.........D...................####################',
    '###...........P.........P.........XXX.......####################',
    '###...........#####S#####..X......XXX.......####################',
    '###...........####...####.........XXX.......####################',
    '###...........####...####...................####################',
    '##################...####...................####################',
    '################################################################',
    '################################################################',
  ],

  wallLegend: {
    '#': { kind: 'wall', tex: 'TECH1' },     // серые техпанели
    't': { kind: 'wall', tex: 'TECH2' },     // панели с вентрешёткой
    'C': { kind: 'wall', tex: 'COMP' },      // компьютерная стена (анимированная)
    'M': { kind: 'wall', tex: 'METAL' },     // тёмный металл
    'P': { kind: 'wall', tex: 'SUPPORT' },   // опоры/рамки дверей
    'X': { kind: 'wall', tex: 'CRATE' },     // ящики на складе
    'O': { kind: 'wall', tex: 'STONE' },     // каменная кладка (двор)
    'K': { kind: 'wall', tex: 'BRICKRED' },  // адская кладка
    'A': { kind: 'wall', tex: 'MARBLE' },    // мрамор (зал барона)
    'F': { kind: 'wall', tex: 'FLESH' },     // стены из плоти
    'D': { kind: 'door', tex: 'DOOR1' },
    'B': { kind: 'door', tex: 'DOORBLUE', key: 'blue' },
    'Y': { kind: 'door', tex: 'DOORYELL', key: 'yellow' },
    'R': { kind: 'door', tex: 'DOORRED', key: 'red' },
    'S': { kind: 'secret', tex: 'TECH1' },   // потайная дверь (секреты №1, №2)
    'V': { kind: 'secret', tex: 'METAL' },   // потайная дверь (секрет №3, у кислоты)
    'E': { kind: 'exit', tex: 'SWEXIT_OFF' },
  },

  zones: [
    'rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrmmmmmmmmmmmmmmmmm',
    'rruuuuuuuuuuuuuuuuurrrrrrrrrrrrrrrrrrrrrrrrrrrrmmmmmmmmmmmmmmmmm',
    'rruuuuuuuuuuuuuuuuurrrrrrrrrrrrrrrrrrrrllllrrrgggggggggggggggggm',
    'rruuuuuuuuuuuuuuuuurrrrrrrrrrrrrrrrrrrrllllrrrgggggggggggggggggm',
    'rruuuuuuuuuuuuuuuuurrrrrlllllrrrrrrrrrrrrrrrrrgggggggggggggggggm',
    'rruuuuuuuuuuuuuuuuurrrrrlllllrrrrrrrrrrrrrrrrrgggggggggggggggggm',
    'rruuuuuuuuuuuuuuuuurrrrrlllllrrrrrrrrrrrrrrrrrgggggggggggggggggm',
    'rruuuuuuuuuuuuuuuuurrrrrlllllrrrrrrrrrrrrrrrrrgggggggggggggggggm',
    'rruuuuuuuuuuuuuuuuurrrrrrrrrrrrrrrrrrrrrrrrrrrggggggggggggbggggm',
    'rruuuuuuuuuuuuuuuuurrrrrrrrrrrrrrrrrrrrrrrrrrrgggggggggggggggggm',
    'rkkkkkkkkkkkkkkkkkurrrrrrrrrrrrrrrrrrrrrrrrrrrgggggggggggggggggm',
    'rkkkkkkkkkkkkkkkkkurrrrrrrrrrrrrrrrrrrrrrrrrrrgggggggggggggggggm',
    'rkkkkklllllkkkkkkkrrrrrrrrrrrrrrrrrrrrrrrrrrrrgggggggggggggggggm',
    'rkkkkklllllkkkkkkkrrrrrrrrrrrrrrrrrrrrrrrrrrrrgggggggggggggggggm',
    'rkkkkkkkkkkkkkkkkkrrrrrrrrrrrrrrrrrrrrrrrrrrrrrmmmmmmmmmmmmmmmmm',
    'rkkkkkkkkkkkkkkkkkrrrrrrrrrrrrrrrrrrrrrrrrrrrrrmmmmmmmmmmmmmmmmm',
    'rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrmmmmmmmmmmmmmmmmm',
    'mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmrrrrrmmmmmmmmwwwwwwmmmmwwwwwwm',
    'mmmmmmmmmmmmmmmmmmmmmmmmmmhhhhhhhhrrrrrhhhhhhhhwwwwwwmmmmwwwwwwm',
    'mmmmmmmmmmmmmmmmmmmmmmmmmmhhhhhhhhrrrrrhhhhhhhhwwwwwwwwwwwwwwwwm',
    'mmmmmmmmmmmmmmmmmmmmmmmmmmhhhhhhhhhhhhhhhhhhhhhwwwwwwwwwwwwwwwwm',
    'mmmmmmmmmmmmmmmmmmmmmmmmmmhhhhhhhhhhhhhhhhhhhhhwwwssssssssswwwwm',
    'mmmmmmmmmmmmmmmmmmmmmmmmmmhhhhhhhhhhhhhhhhhhhhhwwwssssssssswwwwm',
    'mmmmmmmmmmmmmmmmmmmmmmmmmmhhhhhhhhhhhhhhhhhhhhhwwwssssssssswwwwm',
    'mmmmmmmmmmmmmmmmmmmmmmmmmmhhhhhhhhhhhhhhhhhhfffwwwsssaasssswwwsm',
    'mmmmmmmmmmmmmmmmmmmmmvvvvvvvhhhhhhhhhhhhhhhhfffwwwsssaasssswwwsm',
    'mmmmmmmmmmmmmmmmmmmmmvvvvvvvhhhhhhhhhhhhhhhhfffwwwssssssssswwwsm',
    'mmmmmmmmmmmmmmmmmmmmmvvvvvvvhhhhhhhhhhhhhhhhfffwwwssssssssswwwwm',
    'mmmmmmmmmmmmmmmmmmmmmvvvvvvvhhhhhhhhhhhhhhhhhhhwwwssssssssswwwwm',
    'mmmmmmmmmmmmmmmmmmmmmvvvvvvvhhhhhhhhhhhhhhhhhhhwwwssssssssswwwwm',
    'mmmmmmmmmmmmmmmmmmmmmvvvvvvvhhhhhhhhhhhhhhhhhhhwwwssssssssswwwwm',
    'mmmmmmmmmmmmmmmmmmmmmvvvvvvvhhhhhhhhhhhhhhhhhhhwwwwwwwwwwwwwwwwm',
    'mmmmmmmmmmmmmmmmmmmmmmmmmmhhhhhhhhhhhhhhhhhhhhhwwwwwwwwwwwwwwwwm',
    'mmmmmmmmmmmmmmmmmmmmmmmmmmhhhhhhhhhhhhhhhhhhhhhwwwwwwwwwwwwwwwwm',
    'mmmmmmmmmmmmmmmmmmmmmmmmmoooooooooooooooooooooooommmmmmmmmmmmmmm',
    'mmmmmmmmmmmmmmmmmmmmmmmmmoooooooooooooooooooooooommmmmmmmmmmmmmm',
    'mmmmmmmmmmmmmmmmmmmmmmmmmoooooooooooooooooooooooommmmmmmmmmmmmmm',
    'mmmmmmmmmmmmmmmmmmmmmmmmmoooooooooooooooooooooooommmmmmmmmmmmmmm',
    'mpppppmmmmmmmmmmmmmmmmmmmoooooooooooooooooooooooommmmmmmmmmmmmmm',
    'mpppppmmmmmmmmmmmmmmmmmmmoooooooooooooooooooooooommmmmmmmmmmmmmm',
    'mpppppmmmmmmmmmmmmmmmmmmmoooooooooooooooooooooooommmmmmmmmmmmmmm',
    'mpppppmmbmmmmmmmmmmmmmmmmoooooooooooooooooooooooommmmmmmmmmmmmmm',
    'mpppppmmmmmmmmmmmmmmmmmmmoooooooooooooooooooooooommmmmmmmmmmmmmm',
    'mpppppmmmmmmmmmmmmmmmmmmmoooooooooooooooooooooooommmmmmmmmmmmmmm',
    'mpppppmmmmmmmmmmmmmmmmmmmoooooooooooooooooooooooommmmmmmmmmmmmmm',
    'mmmmmmmmmmmmmmmmmmmmmmmmmoooooooooooooooooooooooommmmmmmmmmmmmmm',
    'mmmmmmmmmmmmmmmmmmmmmmmmmoooooooooooooooooooooooommmmmmmmmmmmmmm',
    'mmmmmmmmmmmmmmmmmmmmmmmmmoooooooooooooooooooooooommmmmmmmmmmmmmm',
    'mmmmmmmmmmmmmmmmmmmmmmmmccccccccccccccccccccccmmmmmmmmmmmmmmmmmm',
    'mmmmmmmmmmmmmmmmmmmmmmmmccccccccccccccccccccccmmmmmmmmmmmmmmmmmm',
    'mmmmmmmmmmmmmmmmmmmmmmmmccccccccccccccccccccccmmmmmmmmmmmmmmmmmm',
    'maaaaaaaaaaaaaaammmmmmmmccccccccccccccccccccccmmmmmmmmmmmmmmmmmm',
    'maaaaaaaaaaaaaaammmmmmmmccccccccccccccccccccccmmmmmmmmmmmmmmmmmm',
    'maaaaaaaaaaaaaaammmmmmmmccccccccccccccccccccccmmmmmmmmmmmmmmmmmm',
    'maaaaaaaaaaaaaaammmmmmmmccccccccccccccccccccccmmmmmmmmmmmmmmmmmm',
    'maaaaaaaaaaaaaddddddddddccccccccccccccccccccccmmmmmmmmmmmmmmmmmm',
    'maaaaaaaaaaaaaddddddddddccccccccccccccccccccccmmmmmmmmmmmmmmmmmm',
    'maaaaaaaaaaaaaddddddddddccccccccccccccccccccccmmmmmmmmmmmmmmmmmm',
    'maaaaaaaaaaaaadddpppppddccccccccccccccccccccccmmmmmmmmmmmmmmmmmm',
    'maaaaaaaaaaaaaaampppppmmccccccccccccccccccccccmmmmmmmmmmmmmmmmmm',
    'maaaaaaaaaaaaaaampppppmmccccccccccccccccccccccmmmmmmmmmmmmmmmmmm',
    'maaaaaaaaaaaaaaampppppmmccccccccccccccccccccccmmmmmmmmmmmmmmmmmm',
    'maaaaaaaaaaaaaaampppppmmccccccccccccccccccccccmmmmmmmmmmmmmmmmmm',
    'mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm',
  ],

  zoneLegend: {
    'a': { floor: 'FLOOR_TECH',    ceil: 'CEIL_TECH',  light: 0.85 },               // светлая техзона
    'b': { floor: 'FLOOR_TECH',    ceil: 'CEIL_LIGHT', light: 1.0 },                // пьедесталы ключей
    'c': { floor: 'FLOOR_GRAY',    ceil: 'CEIL_TECH',  light: 0.55 },               // склад
    'd': { floor: 'FLOOR_GRAY',    ceil: 'CEIL_TECH',  light: 0.3 },                // тёмный коридор
    'f': { floor: 'FLOOR_TECH',    ceil: 'CEIL_TECH',  light: 0.7,  flicker: true },// коридор E (фликер)
    'g': { floor: 'FLOOR_HEX',     ceil: 'CEIL_TECH',  light: 0.5,  flicker: true },// ловушка жёлтого ключа
    'h': { floor: 'FLOOR_HEX',     ceil: 'CEIL_TECH',  light: 0.8 },                // машинный зал
    'k': { floor: 'FLOOR_REDROCK', ceil: 'CEIL_HELL',  light: 0.35 },               // тёмный карман ада
    'l': { floor: 'LAVA',          ceil: 'CEIL_HELL',  light: 0.8,  damage: 20 },   // лава
    'm': { floor: 'FLOOR_TECH',    ceil: 'CEIL_TECH',  light: 0.6 },                // служебные коридоры
    'o': { floor: 'FLOOR_DIRT',    ceil: 'SKY',        light: 0.95 },               // двор под небом
    'p': { floor: 'FLOOR_GRAY',    ceil: 'CEIL_TECH',  light: 0.45 },               // секретные ниши
    'r': { floor: 'FLOOR_REDROCK', ceil: 'CEIL_HELL',  light: 0.55 },               // адская зона
    's': { floor: 'NUKAGE',        ceil: 'CEIL_TECH',  light: 0.7,  damage: 10 },   // кислота
    'u': { floor: 'FLOOR_REDROCK', ceil: 'CEIL_HELL',  light: 0.75 },               // зал барона
    'v': { floor: 'FLOOR_TECH',    ceil: 'CEIL_LIGHT', light: 0.95 },               // хранилище BFG
    'w': { floor: 'FLOOR_HEX',     ceil: 'CEIL_TECH',  light: 0.65 },               // настил резервуара
  },

  playerStart: { x: 6.5, y: 57.5, angle: 0 },

  things: [
    // — стартовая комната —
    { type: 'zombie', x: 11.5, y: 55.5, angle: 0 },
    { type: 'zombie', x: 11.5, y: 59.5, angle: 0 },
    { type: 'zombie', x: 10.5, y: 53.5, angle: Math.PI / 2, skills: [3, 4] },
    { type: 'ammo_clip', x: 4.5, y: 55.5 },
    { type: 'ammo_clip', x: 9.5, y: 60.5 },
    { type: 'stimpack', x: 4.5, y: 59.5 },
    { type: 'lamp', x: 3.5, y: 53.5 },
    { type: 'lamp', x: 13.5, y: 53.5 },
    { type: 'corpse0', x: 5.5, y: 54.5 },
    // — тёмный коридор A + секрет №1 —
    { type: 'zombie', x: 21.5, y: 56.5, angle: Math.PI },
    { type: 'healthbonus', x: 16.5, y: 57.5 },
    { type: 'healthbonus', x: 17.5, y: 57.5 },
    { type: 'corpse0', x: 18.5, y: 56.5 },
    { type: 'armorgreen', x: 19.5, y: 60.5 },
    { type: 'ammo_bulletbox', x: 18.5, y: 59.5 },
    { type: 'ammo_shells', x: 20.5, y: 59.5 },
    { type: 'stimpack', x: 20.5, y: 60.5 },
    // — склад с ящиками —
    { type: 'zombie', x: 27.5, y: 51.5, angle: Math.PI / 2 },
    { type: 'zombie', x: 41.5, y: 59.5, angle: Math.PI },
    { type: 'sergeant', x: 32.5, y: 56.5, angle: Math.PI },
    { type: 'sergeant', x: 37.5, y: 52.5, angle: Math.PI },
    { type: 'sergeant', x: 30.5, y: 60.5, angle: -Math.PI / 2, skills: [3, 4] },
    { type: 'imp', x: 26.5, y: 55.5, angle: Math.PI / 2, skills: [4] },
    { type: 'pickup_shotgun', x: 38.5, y: 55.5 },
    { type: 'ammo_shells', x: 26.5, y: 52.5 },
    { type: 'ammo_shells', x: 31.5, y: 58.5 },
    { type: 'ammo_clip', x: 42.5, y: 54.5 },
    { type: 'ammo_shellbox', x: 40.5, y: 57.5 },
    { type: 'medikit', x: 25.5, y: 60.5 },
    { type: 'barrel', x: 25.5, y: 51.5 },
    { type: 'barrel', x: 26.5, y: 51.5 },
    { type: 'barrel', x: 33.5, y: 51.5 },
    { type: 'barrel', x: 37.5, y: 60.5 },
    { type: 'lamp', x: 25.5, y: 50.5 },
    { type: 'lamp', x: 43.5, y: 50.5 },
    { type: 'corpse0', x: 42.5, y: 60.5 },
    // — открытый двор (небо) —
    { type: 'imp', x: 29.5, y: 34.5, angle: Math.PI / 2 },
    { type: 'imp', x: 39.5, y: 34.5, angle: Math.PI / 2 },
    { type: 'imp', x: 47.5, y: 39.5, angle: Math.PI },
    { type: 'zombie', x: 36.5, y: 42.5, angle: Math.PI / 2 },
    { type: 'imp', x: 40.5, y: 34.5, angle: Math.PI / 2, skills: [3, 4] },
    { type: 'imp', x: 47.5, y: 40.5, angle: Math.PI, skills: [3, 4] },
    { type: 'cacodemon', x: 36.5, y: 38.5, angle: Math.PI / 2, skills: [4] },
    { type: 'stimpack', x: 27.5, y: 36.5 },
    { type: 'ammo_clip', x: 44.5, y: 36.5 },
    { type: 'ammo_shells', x: 44.5, y: 44.5 },
    { type: 'healthbonus', x: 35.5, y: 45.5 },
    { type: 'healthbonus', x: 36.5, y: 45.5 },
    { type: 'barrel', x: 28.5, y: 45.5 },
    { type: 'barrel', x: 29.5, y: 45.5 },
    { type: 'barrel', x: 43.5, y: 35.5 },
    { type: 'pillar', x: 26.5, y: 35.5 },
    { type: 'pillar', x: 46.5, y: 35.5 },
    { type: 'pillar', x: 26.5, y: 46.5 },
    { type: 'pillar', x: 46.5, y: 46.5 },
    // — коридор C и синее крыло (засада, СИНИЙ ключ) —
    { type: 'stimpack', x: 22.5, y: 40.5 },
    { type: 'sergeant', x: 12.5, y: 38.5, angle: 0 },
    { type: 'sergeant', x: 12.5, y: 44.5, angle: 0 },
    { type: 'imp', x: 7.5, y: 37.5, angle: 0 },
    { type: 'imp', x: 7.5, y: 45.5, angle: 0 },
    { type: 'imp', x: 14.5, y: 49.5, angle: -Math.PI / 2 },
    { type: 'imp', x: 16.5, y: 41.5, angle: 0, skills: [3, 4] },
    { type: 'demon', x: 10.5, y: 33.5, angle: Math.PI / 2, skills: [3, 4] },
    { type: 'sergeant', x: 9.5, y: 43.5, angle: -Math.PI / 2, skills: [4] },
    { type: 'key_blue', x: 8.5, y: 41.5 },
    { type: 'armorbonus', x: 7.5, y: 40.5 },
    { type: 'armorbonus', x: 7.5, y: 42.5 },
    { type: 'ammo_clip', x: 11.5, y: 41.5 },
    { type: 'ammo_shellbox', x: 17.5, y: 37.5 },
    { type: 'medikit', x: 17.5, y: 45.5 },
    { type: 'barrel', x: 18.5, y: 42.5 },
    { type: 'barrel', x: 6.5, y: 36.5 },
    { type: 'lamp', x: 8.5, y: 39.5 },
    { type: 'lamp', x: 8.5, y: 43.5 },
    // — секрет №2: soulsphere + плазмаган —
    { type: 'soulsphere', x: 3.5, y: 41.5 },
    { type: 'pickup_plasmarifle', x: 3.5, y: 39.5 },
    { type: 'ammo_cell', x: 2.5, y: 42.5 },
    { type: 'ammo_cell', x: 3.5, y: 43.5 },
    // — машинный зал (за СИНЕЙ дверью) —
    { type: 'demon', x: 31.5, y: 23.5, angle: Math.PI / 2 },
    { type: 'demon', x: 40.5, y: 28.5, angle: Math.PI },
    { type: 'zombie', x: 29.5, y: 29.5, angle: 0 },
    { type: 'imp', x: 43.5, y: 21.5, angle: Math.PI },
    { type: 'demon', x: 35.5, y: 22.5, angle: Math.PI / 2, skills: [3, 4] },
    { type: 'zombie', x: 42.5, y: 30.5, angle: Math.PI, skills: [3, 4] },
    { type: 'imp', x: 33.5, y: 30.5, angle: -Math.PI / 2, skills: [4] },
    { type: 'pickup_chaingun', x: 36.5, y: 29.5 },
    { type: 'ammo_bulletbox', x: 29.5, y: 20.5 },
    { type: 'ammo_clip', x: 38.5, y: 21.5 },
    { type: 'ammo_shellbox', x: 28.5, y: 25.5 },
    { type: 'stimpack', x: 34.5, y: 20.5 },
    { type: 'medikit', x: 43.5, y: 30.5 },
    { type: 'barrel', x: 30.5, y: 21.5 },
    { type: 'barrel', x: 31.5, y: 21.5 },
    { type: 'barrel', x: 44.5, y: 29.5 },
    { type: 'lamp', x: 28.5, y: 20.5 },
    { type: 'lamp', x: 44.5, y: 31.5 },
    { type: 'corpse0', x: 29.5, y: 30.5 },
    // — хранилище за КРАСНОЙ дверью —
    { type: 'pickup_bfg', x: 24.5, y: 28.5 },
    { type: 'armorblue', x: 23.5, y: 26.5 },
    { type: 'ammo_cellpack', x: 25.5, y: 26.5 },
    { type: 'ammo_rocketbox', x: 23.5, y: 29.5 },
    { type: 'ammo_cell', x: 25.5, y: 29.5 },
    { type: 'lamp', x: 26.5, y: 30.5 },
    // — коридор E (фликер) и кислотный резервуар —
    { type: 'healthbonus', x: 46.5, y: 25.5 },
    { type: 'imp', x: 52.5, y: 19.5, angle: Math.PI },
    { type: 'imp', x: 59.5, y: 28.5, angle: Math.PI },
    { type: 'sergeant', x: 50.5, y: 31.5, angle: Math.PI },
    { type: 'imp', x: 56.5, y: 19.5, angle: Math.PI, skills: [3, 4] },
    { type: 'demon', x: 53.5, y: 27.5, angle: Math.PI, skills: [4] },
    { type: 'pickup_rocketlauncher', x: 59.5, y: 19.5 },
    { type: 'armorgreen', x: 53.5, y: 24.5 },
    { type: 'ammo_rocketbox', x: 54.5, y: 25.5 },
    { type: 'ammo_rocket', x: 48.5, y: 19.5 },
    { type: 'ammo_rocket', x: 59.5, y: 31.5 },
    { type: 'medikit', x: 48.5, y: 32.5 },
    { type: 'healthbonus', x: 60.5, y: 25.5 },
    { type: 'key_red', x: 62.5, y: 25.5 },
    { type: 'barrel', x: 48.5, y: 21.5 },
    { type: 'barrel', x: 59.5, y: 30.5 },
    { type: 'lamp', x: 60.5, y: 19.5 },
    // — коридор G и комната ЖЁЛТОГО ключа (ловушка) —
    { type: 'stimpack', x: 54.5, y: 16.5 },
    { type: 'demon', x: 52.5, y: 3.5, angle: Math.PI / 2 },
    { type: 'imp', x: 57.5, y: 3.5, angle: Math.PI / 2 },
    { type: 'imp', x: 46.5, y: 9.5, angle: 0 },
    { type: 'imp', x: 56.5, y: 3.5, angle: Math.PI / 2, skills: [3, 4] },
    { type: 'imp', x: 46.5, y: 10.5, angle: 0, skills: [3, 4] },
    { type: 'demon', x: 51.5, y: 3.5, angle: Math.PI / 2, skills: [4] },
    { type: 'key_yellow', x: 58.5, y: 8.5 },
    { type: 'healthbonus', x: 57.5, y: 8.5 },
    { type: 'medikit', x: 49.5, y: 6.5 },
    { type: 'ammo_rocketbox', x: 59.5, y: 6.5 },
    { type: 'ammo_shellbox', x: 50.5, y: 11.5 },
    { type: 'ammo_bulletbox', x: 59.5, y: 11.5 },
    // — тамбур ЖЁЛТОЙ двери и адская зона —
    { type: 'healthbonus', x: 36.5, y: 15.5 },
    { type: 'ammo_cell', x: 36.5, y: 17.5 },
    { type: 'cacodemon', x: 30.5, y: 6.5, angle: Math.PI / 2 },
    { type: 'cacodemon', x: 21.5, y: 9.5, angle: 0 },
    { type: 'imp', x: 38.5, y: 4.5, angle: Math.PI / 2 },
    { type: 'imp', x: 25.5, y: 12.5, angle: 0 },
    { type: 'demon', x: 33.5, y: 9.5, angle: Math.PI / 2 },
    { type: 'imp', x: 41.5, y: 8.5, angle: Math.PI / 2, skills: [3, 4] },
    { type: 'cacodemon', x: 36.5, y: 12.5, angle: Math.PI / 2, skills: [3, 4] },
    { type: 'imp', x: 24.5, y: 9.5, angle: Math.PI / 2, skills: [4] },
    { type: 'imp', x: 5.5, y: 12.5, angle: 0, skills: [4] },
    { type: 'ammo_cell', x: 39.5, y: 13.5 },
    { type: 'ammo_shellbox', x: 20.5, y: 13.5 },
    { type: 'ammo_bulletbox', x: 30.5, y: 5.5 },
    { type: 'medikit', x: 42.5, y: 6.5 },
    { type: 'stimpack', x: 24.5, y: 10.5 },
    { type: 'ammo_rocketbox', x: 3.5, y: 12.5 },
    { type: 'medikit', x: 3.5, y: 13.5 },
    { type: 'barrel', x: 33.5, y: 13.5 },
    { type: 'barrel', x: 18.5, y: 11.5 },
    { type: 'torch', x: 35.5, y: 15.5 },
    { type: 'torch', x: 37.5, y: 15.5 },
    { type: 'torch', x: 18.5, y: 13.5 },
    { type: 'torch', x: 43.5, y: 4.5 },
    { type: 'torch', x: 23.5, y: 2.5 },
    { type: 'corpse1', x: 20.5, y: 7.5 },
    { type: 'corpse1', x: 38.5, y: 8.5 },
    // — зал барона и выход —
    { type: 'baron', x: 8.5, y: 6.5, angle: 0 },
    { type: 'imp', x: 13.5, y: 4.5, angle: 0, skills: [3, 4] },
    { type: 'imp', x: 13.5, y: 8.5, angle: 0, skills: [4] },
    { type: 'demon', x: 15.5, y: 6.5, angle: 0, skills: [4] },
    { type: 'medikit', x: 5.5, y: 4.5 },
    { type: 'ammo_rocketbox', x: 5.5, y: 8.5 },
    { type: 'torch', x: 4.5, y: 4.5 },
    { type: 'torch', x: 4.5, y: 8.5 },
    { type: 'torch', x: 15.5, y: 3.5 },
  ],
};

// ============================== КАРТА ОБЛАСТЕЙ ==============================
//
//   x:0        x:17        x:34        x:48       x:63
// y:2  +--------------------------------------+ +--------+
//      |  ЗАЛ БАРОНА  |       АДСКАЯ ЗОНА     | | ШКАФЫ  |  <- ловушка ключа
//      | [E]=выход    |  лава, какодемоны,    | +--D-D---+
//      |  мрамор      |  плоть/кладка         | | ЖЁЛТЫЙ |
// y:10 +---------     |                       |D| КЛЮЧ   |  <- фликер
//      | тёмный карман| (тамбур: x35-37,y15-18)| | (x49-60,|
// y:15 +-----------------------[Y]------------+ |  y6-12) |
//                       жёлтая дверь (36,19)    +---D----+
// y:19 +-----------------+ +----+ +------------+ | корид.G
//      | МАШИННЫЙ ЗАЛ    |.| кор.| | КИСЛОТНЫЙ  |<- секрет №3 'V'(61,25):
//      | пулемёт, демоны |.| E   | | РЕЗЕРВУАР  |   ниша красного ключа
// y:26 |        [R]------+ |флик.| | бассейн s, | (62,24-26, в кислоте)
//      | хранилище BFG   | +----+ | остров с   |
// y:31 | (x22-26,y26-30) |        | бронёй     |
//      +--------[B]------+        +-(x48-60)---+
//                синяя дверь (36,34)
// y:34 +------------------------------------+
//      | ниши с импами -> ДВОР ПОД НЕБОМ    |   секрет №2 'S'(5,41):
//      | (x26-46, y35-46), грунт, колонны   |   soulsphere+плазмаган (x2-4)
// y:40 |  <- проём -> коридор C -> СИНЕЕ    |
//      |     КРЫЛО (x6-19,y36-46): засада,  |
// y:47 |     синий ключ, шкафы D4/D5        |
//      +--------[D](34,49)------------------+
// y:50 +------------------------------------+
//      | СКЛАД: ящики, сержанты, дробовик   |
//      | (x25-43, y50-61)                   |
// y:56 +--[D](24,56)--- тёмный коридор A ---+   секрет №1 'S'(19,58):
//      |   [D](14,56)   (x15-23, y56-57)    |   броня+патроны (x18-20,y59-61)
// y:61 | СТАРТ (x3-13, y53-60), зомби       |
//      +------------------------------------+
//
// Маршрут: СТАРТ -> коридор A -> склад -> двор -> синее крыло (СИНИЙ ключ)
//   -> синяя дверь (36,34) -> машинный зал -> коридор E -> кислотный резервуар
//   -> коридор G -> ЖЁЛТЫЙ ключ (ловушка: фликер + шкафы D11/D12/D13)
//   -> назад в зал -> жёлтая дверь (36,19) -> тамбур -> АД -> зал барона
//   -> рубильник ВЫХОД (3,6). КРАСНЫЙ ключ: секрет 'V'(61,25) у кислоты ->
//   красная дверь (27,28) -> хранилище BFG + синяя броня.

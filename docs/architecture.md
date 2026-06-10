# HELLBOUND — архитектура (КОНТРАКТ)

Этот документ — обязательный контракт для всех модулей. Имена файлов, экспортов,
сигнатуры и ключи ассетов должны совпадать с указанными здесь ТОЧНО.

## §1. Обзор

Законченный клон DOOM (1993): один уровень («ТЕХБАЗА „ГЕФЕСТ-1"»), 7 видов оружия,
6 типов врагов, ключи-карты, секреты, взрывающиеся бочки, урон от кислоты, HUD с лицом
героя, автокарта, стартовое меню с выбором сложности, настройки, пауза, экран смерти,
экран статистики после уровня, процедурные звук и музыка.

Стек: чистый JS (ES-модули, `"type": "module"`), Canvas 2D, WebAudio. Без зависимостей,
без внешних файлов-ассетов — всё генерируется кодом. Запуск: `python3 -m http.server`.

Целевая производительность: 60 FPS при внутреннем разрешении 480×300.

## §2. Файлы и владельцы

```
index.html, css/style.css, package.json      — каркас (готово)
js/config.js                                  — константы и дефиниции (готово)
js/engine/physics.js                          — коллизии (готово)
js/engine/raycaster.js                        — рендерер              [агент B1]
js/engine/input.js                            — ввод                  [агент B5]
js/game/level1.js                             — данные уровня         [агент B2]
js/game/map.js                                — карта/двери (интегратор)
js/game/game.js                               — игровая логика (интегратор)
js/game/enemies.js                            — враги и ИИ            [агент B3]
js/game/weapons.js                            — оружие игрока         [агент B4]
js/game/player.js                             — игрок                 [агент B5]
js/ui/font.js                                 — пиксельный шрифт      [агент F1]
js/ui/hud.js                                  — HUD + автокарта       [агент B6]
js/ui/menu.js                                 — меню и экраны         [агент B7]
js/assets/textures.js                         — текстуры стен/полов   [агент A1]
js/assets/sprites_enemies1.js  (zombie, sergeant)                     [агент A2a]
js/assets/sprites_enemies2.js  (imp, demon)                           [агент A2b]
js/assets/sprites_enemies3.js  (cacodemon, baron)                     [агент A2c]
js/assets/sprites_weapons.js                  — оружие от 1-го лица   [агент A3]
js/assets/sprites_items.js                    — предметы и декор      [агент A4]
js/assets/sprites_fx.js                       — снаряды и эффекты     [агент A5]
js/assets/sprites_ui.js                       — лицо, логотип, фоны   [агент A6]
js/assets/sounds.js                           — звуковой движок       [агент A7]
js/assets/music.js                            — музыка                [агент A8]
js/main.js                                    — точка входа (интегратор)
```

Каждый агент пишет ТОЛЬКО свой файл. Чужие файлы не менять. Импортировать можно
только: js/config.js, js/engine/physics.js, js/ui/font.js (для ui-модулей) и то,
что явно указано в разделе модуля.

## §3. Координаты, единицы, соглашения

- Карта — сетка клеток 1.0×1.0. Позиции — float (x, y). Стены высотой ровно 1.0
  (пол z=0, потолок z=1). Высота глаз игрока `EYE = 0.5` (+качание).
- Угол — радианы, 0 = +X, растёт против часовой? НЕТ: экранная система — угол растёт
  ПО часовой при повороте вправо; направление: `dx = cos(a), dy = sin(a)`; ось Y вниз
  по карте (строки массива). Это согласовано само с собой — главное использовать
  `cos/sin` единообразно.
- Экран: 480×300, из них 3D-вид — строки 0..251 (`VIEW_H=252`), HUD — нижние 48px.
- `pitch` — вертикальный взгляд, в ПИКСЕЛЯХ сдвига горизонта, диапазон ±60.
  Горизонт: `horizon = VIEW_H/2 + pitch`.
- Время: фиксированный шаг логики `dt = 1/60`, рендер каждый rAF.
- Все модули — ES-модули. Никаких `fetch`, `new Image`, внешних URL. Канвасы создавать
  через `document.createElement('canvas')`.
- console.log не оставлять; допустим `console.warn` при отсутствии ассета.

## §4. Общий стиль ассетов (ОБЯЗАТЕЛЬНО для A1–A6)

Цель: «как спрайты и текстуры DOOM 1993», не как программистский плейсхолдер.

- Рисовать пиксель-артом: целочисленная сетка, `ctx.fillRect(x, y, 1, 1)` или хелпер
  `px(ctx,x,y,color)`. НИКАКИХ плавных градиентов (`createLinearGradient` запрещён),
  НИКАКОГО сглаживания, НИКАКИХ `arc()` с заливкой больших кругов без пикселизации.
  Дизеринг (шахматное смешение двух тонов) — да.
- На материал 3–6 тонов. Свет сверху-слева. У объектов тёмный контур (не чисто
  чёрный — очень тёмный тон материала).
- Читаемый силуэт: монстр узнаваем на расстоянии по форме.
- Палитра (придерживаться, оттенки можно варьировать):
  металл `#1b1d22 #2e3138 #494e58 #6d7380 #99a0ad`,
  ржавчина `#3a2417 #6b3a24 #9c5a2e #c97f45`,
  кровь/демоны `#3d0a0a #6e1111 #a51c1c #d23b1e #ff6b3d`,
  кислота `#15300f #2c5e1a #3aa32a #7ade3f`,
  кожа `#5c4632 #8a6b48 #c8a06e #e8cfa0`,
  огонь `#7a1f08 #c44d12 #f08a1d #ffd24a #fff6c9`,
  тень/фон `#0a0a0d #141419`.
- Случайность (шум, трещины, пятна) — через свой маленький детерминированный PRNG
  (например mulberry32 с фиксированным сидом), НЕ `Math.random()`, чтобы вид был
  стабильным между запусками.
- Прозрачность спрайтов: фон полностью прозрачный (alpha 0). Полупрозрачность
  допустима только у огня/плазмы/дыма.
- Наземные спрайты: ноги/основание на НИЖНЕЙ кромке канваса. Летающие (какодемон,
  снаряды, взрывы) — по центру.

Каждый модуль ассетов экспортирует ровно одну функцию:
```js
export function generateSprites() { ... return map; }   // Map<string, HTMLCanvasElement>
// (для textures.js — generateTextures())
```
Размер канваса — указанный в разделе. Внутри файла можно (и нужно) строить общие
хелперы рисования; между файлами хелперы не шарить.

## §5. Текстуры — js/assets/textures.js [A1]

`export function generateTextures(): Map<string, HTMLCanvasElement>`

Стены 64×64 (если не сказано иное):

| Ключ | Описание |
|---|---|
| `TECH1` | серые техпанели, заклёпки, стыки |
| `TECH2` | панели с вентрешёткой и кабелями |
| `COMP0`,`COMP1` | компьютерная стена: стойки, лампочки; 2 кадра анимации (мигают огни) |
| `METAL` | тёмный металл с горизонтальными балками и потёками ржавчины |
| `SUPPORT` | металлическая опора/рамка двери: вертикальные рёбра, болты |
| `CRATE` | штабель ящиков (дерево + металлические уголки) |
| `STONE` | серая грубая каменная кладка |
| `BRICKRED` | адская тёмно-красная кладка с трещинами |
| `MARBLE` | зелёно-серый мрамор с прожилками и демоническим барельефом-черепом |
| `FLESH` | стена из плоти: вены, нарывы |
| `DOOR1` | техническая дверь: панель с жёлтыми полосами «ОПАСНО», шов посередине |
| `DOORBLUE` | дверь с синими сигнальными полосами/лампами |
| `DOORYELL` | дверь с жёлтыми лампами |
| `DOORRED` | дверь с красными лампами |
| `SWEXIT_OFF` | стена-рубильник ВЫХОД: панель, рычаг вверх, надпись-пиктограмма EXIT |
| `SWEXIT_ON` | то же, рычаг вниз, лампа горит |
| `SKY1` | **1024×256**, панорама: тёмно-багровое небо, силуэты гор ада, дальние огни |

Полы/потолки 64×64 (тайлятся бесшовно!):

| Ключ | Описание |
|---|---|
| `FLOOR_TECH` | металлические плиты с болтами |
| `FLOOR_HEX` | шестигранная сетка-настил |
| `FLOOR_GRAY` | бетон с пятнами |
| `FLOOR_DIRT` | грунт/гравий (двор) |
| `FLOOR_REDROCK` | красный адский камень |
| `NUKAGE0..2` | кислота, 3 кадра анимации (пузыри в разных фазах) |
| `LAVA0..1` | лава, 2 кадра |
| `CEIL_TECH` | потолочные панели |
| `CEIL_LIGHT` | панель со светящимися лампами (почти белая, яркая) |
| `CEIL_HELL` | красный камень с трещинами, из которых светится лава |

Все текстуры обязаны тайлиться по обеим осям (края совпадают).

## §6. Спрайты врагов [A2a: zombie,sergeant; A2b: imp,demon; A2c: cacodemon,baron]

Канвас 64×64; у `baron` — 96×96. Враг смотрит НА игрока (анфас).
Ключи: `<type>_walk0..3`, `<type>_attack0..2`, `<type>_pain0`, `<type>_die0..4`
(итого 13 ключей на врага).

- walk: цикл шага (0 и 2 — опорные, 1 и 3 — ноги в шаге, лёгкое покачивание корпуса).
- attack: замах/бросок/выстрел (кадр 1 — момент атаки: вспышка у ствола, файербол в руке).
- pain: вздрогнул, отшатнулся.
- die0..4: падение по стадиям до лежащего трупа (die4 — труп на полу, низкий,
  кровь под ним; этот кадр остаётся лежать в мире).

Образы (свои, в духе Doom, не копия):
- `zombie` — зомби-солдат: зелёно-бурая форма, серая кожа, кровь на груди, винтовка.
- `sergeant` — как zombie, но чёрная форма, лысый, дробовик; чуть шире.
- `imp` — бурый демон с шипами на плечах, когти; attack — швыряет огненный шар
  (шар рисовать в руке на кадрах 0-1, на кадре 2 рука выброшена вперёд, шара нет).
- `demon` — «пинки»: массивный розово-мясной зверь, огромная пасть; attack — кусает.
- `cacodemon` — летающая красная сфера с одним зелёным глазом и пастью; walk —
  парение (немного меняется форма/рот); attack — открывает пасть, внутри молния.
- `baron` — рогатый козлоногий гигант, светло-кожаный торс, зелёные глаза; attack —
  зелёный сгусток в ладони.

Кровь у всех красная, у cacodemon — синяя (в die-кадрах).

## §7. Оружие от первого лица — js/assets/sprites_weapons.js [A3]

Канвас **240×160**. Контент прижат к нижнему краю, по горизонтали центр.
Оружие+руки занимают ~50–60% ширины канваса. Вспышка выстрела РИСУЕТСЯ в кадрах fire.

| Оружие | Ключи |
|---|---|
| кулак | `wpn_fist_idle`, `wpn_fist_fire0..2` (замах, удар вперёд, возврат) |
| пистолет | `wpn_pistol_idle`, `wpn_pistol_fire0..2` (вспышка, отдача, возврат) |
| дробовик | `wpn_shotgun_idle`, `wpn_shotgun_fire0..4` (вспышка, отдача, перелом/помпа вниз, помпа вверх, возврат) |
| пулемёт | `wpn_chaingun_idle`, `wpn_chaingun_fire0..1` (два кадра вспышки, стволы в разных фазах) |
| ракетница | `wpn_rocketlauncher_idle`, `wpn_rocketlauncher_fire0..2` (вспышка+дым, отдача, возврат) |
| плазмаган | `wpn_plasmarifle_idle`, `wpn_plasmarifle_fire0..1` (синее свечение дула) |
| BFG | `wpn_bfg_idle`, `wpn_bfg_fire0..3` (зарядка зелёным — мелкое свечение, большое, выстрел-вспышка, возврат) |

Руки в перчатках (как у Doomguy). Металл оружия — палитра «металл», вспышки — «огонь»,
плазма — голубое `#46c8ff #9ce6ff`, BFG — зелёное `#2cab2c #7ade3f #d6ff9e`.

## §8. Предметы и декор — js/assets/sprites_items.js [A4]

Канвас 64×64, основание на нижней кромке (кроме отмеченных).

| Ключ | Описание |
|---|---|
| `stimpack` | малая аптечка (белая коробочка, красный крест) |
| `medikit` | большая аптечка |
| `healthbonus` | маленькая синяя склянка со светящейся жидкостью |
| `armorbonus` | маленький шлем |
| `armorgreen` | зелёный бронежилет на стойке |
| `armorblue` | синий бронежилет |
| `soulsphere` | синяя полупрозрачная сфера с лицом внутри (центрирована, парит) |
| `ammo_clip` | обойма |
| `ammo_bulletbox` | коробка патронов |
| `ammo_shells` | 4 патрона дробовика |
| `ammo_shellbox` | коробка дроби |
| `ammo_rocket` | одна ракета |
| `ammo_rocketbox` | ящик ракет (3 штуки) |
| `ammo_cell` | малая энергобатарея (зелёное свечение) |
| `ammo_cellpack` | большой энергоблок |
| `pickup_shotgun` | дробовик на полу |
| `pickup_chaingun` | пулемёт на полу |
| `pickup_rocketlauncher` | ракетница на полу |
| `pickup_plasmarifle` | плазмаган на полу |
| `pickup_bfg` | BFG на полу (массивная зелёная пушка) |
| `key_blue` | синяя ключ-карта |
| `key_yellow` | жёлтая ключ-карта |
| `key_red` | красная ключ-карта |
| `barrel` | бочка с зелёной светящейся жижей (как в Doom) |
| `lamp0`,`lamp1` | напольная техно-лампа, 2 кадра лёгкого мерцания |
| `torch0..3` | адский факел на подставке, 4 кадра пламени |
| `pillar` | короткая техно-колонна |
| `corpse0` | труп морпеха у стены |
| `corpse1` | насаженное на кол тело (адский декор) |

Ключи-карты и склянки — яркие, с бликом (их должно быть видно издалека).

## §9. Снаряды и эффекты — js/assets/sprites_fx.js [A5]

Канвас 32×32 для снарядов и puff/blood, 64×64 для взрывов/bfg. Всё центрировано.

| Ключ | Описание |
|---|---|
| `fireball0..1` | оранжевый огненный шар с хвостом |
| `cacoball0..1` | сине-фиолетовая шаровая молния |
| `baronball0..1` | зелёный сгусток |
| `rocketproj0` | летящая ракета (видна сзади-сбоку: корпус + выхлоп) |
| `plasmaball0..1` | голубой сгусток плазмы |
| `bfgball0..1` | большой зелёный пульсирующий шар (64×64) |
| `puff0..3` | серый дымок попадания в стену, рассеивается |
| `blood0..3` | брызги крови, оседают |
| `explosion0..5` | взрыв 64×64: вспышка→огненный шар→дым (кадры 4-5 тёмные) |
| `fb_hit0..2` | вспышка попадания файербола 32×32 |
| `plasma_hit0..1` | голубая вспышка 32×32 |
| `bfg_hit0..2` | зелёная вспышка 64×64 |

## §10. UI-спрайты — js/assets/sprites_ui.js [A6]

| Ключ | Размер | Описание |
|---|---|---|
| `face_<t>_fwd` `face_<t>_left` `face_<t>_right` | 36×40 | лицо героя, t=0..4 — степень окровавленности (0 целый, 4 еле жив); взгляд прямо/влево/вправо |
| `face_<t>_pain` | 36×40 | гримаса боли, t=0..4 |
| `face_<t>_grin` | 36×40 | злая ухмылка (взял оружие), t=0..4 |
| `face_dead` | 36×40 | мёртвое лицо, глаза закрыты, всё в крови |
| `hudkey_blue` `hudkey_yellow` `hudkey_red` | 16×16 | иконки ключей для HUD |
| `logo` | 400×110 | логотип «HELLBOUND»: массивные металлические буквы с подсветкой огнём снизу, как логотип DOOM |
| `title_bg` | 480×300 | фон титула: марсианский пейзаж, силуэт базы, багровое небо, в небе горящий портал |
| `inter_bg` | 480×300 | фон экрана статистики: тёмная стилизованная карта базы / адский ландшафт, приглушённый |

Лицо: квадратная челюсть, рыжие волосы, зелёный ворот брони. Кровь нарастает с t.
Фоны — тоже пиксель-арт (крупные «пиксели» 2×2 допустимы), без плавных градиентов.

## §11. Звук — js/assets/sounds.js [A7]

```js
export function getAudioCtx(): AudioContext|null   // ленивый синглтон; null если недоступен
export class SoundEngine {
  constructor()
  resume()                      // вызвать по первому пользовательскому вводу
  setVolume(v)                  // 0..1 общий уровень SFX
  play(name, {volume=1, pan=0} = {})   // pan -1..1; не бросать исключений никогда
}
```

Все звуки синтезируются узлами WebAudio в момент `play` (осцилляторы, шум через
AudioBuffer с белым шумом + фильтры + огибающие). Длительность ≤1.5с. Если
AudioContext недоступен или suspended — тихо no-op. Звуки должны быть СОЧНЫМИ,
в духе Doom: низкие, мясистые, с атакой.

Полный список имён:
- UI: `menu_move, menu_select, menu_back`
- Игрок: `pl_pain, pl_die, pl_pickup, pl_wpnup, pl_keyup, pl_power, pl_noammo, pl_oof`
- Оружие: `wp_punch, wp_swing, wp_pistol, wp_shotgun, wp_pump, wp_chaingun, wp_rocket, wp_plasma, wp_bfg, wp_bfg_hit, explosion`
- Мир: `door_open, door_close, switch, secret`
- Снаряды: `prj_fire, prj_hit`
- Враги, для каждого из `zombie, sergeant, imp, demon, cacodemon, baron`:
  `en_<type>_sight, en_<type>_pain, en_<type>_die, en_<type>_attack`
  (рык/вой при обнаружении, боль, смерть, атака; у зомби attack = выстрел, можно
  переиспользовать генератор пистолета с вариацией).

Характеры: zombie/sergeant — хриплые человеческие; imp — шипящий визг; demon —
утробный рёв и чавкающий укус; cacodemon — электрическое гудение/бульканье;
baron — низкий мощный рёв. Смерти — протяжные, с понижением тона.

## §12. Музыка — js/assets/music.js [A8]

```js
export class MusicPlayer {
  constructor()                  // использует getAudioCtx() из sounds.js
  start(name)                    // 'menu' | 'level' | 'victory'; перезапускает трек
  stop()
  setVolume(v)                   // 0..1
}
```
Импортирует `getAudioCtx` из `./sounds.js`.

Секвенсор с lookahead-планированием (setInterval ~25ms, планирование на 0.1с вперёд).
Дорожки: бас (пила/квадрат через lowpass), лид (квадрат с лёгким детюном), ударные
(кик — синус с падением частоты, снейр/хэт — шум с фильтром).

- `menu` — медленный зловещий эмбиент: низкий гул, редкие «колокола», минор, ~70 BPM.
- `level` — драйвовый рифф в духе E1M1: галопирующий бас E-минор, ~138 BPM,
  структура из 4+ паттернов (рифф A, рифф A', бридж, соло-вставка), цикл ~60с без швов.
- `victory` — короткая триумфальная тема, ~100 BPM.

Безопасная деградация без AudioContext. Громкость через мастер-gain.

## §13. Рейкастер — js/engine/raycaster.js [B1]

```js
import { ... } from '../config.js';
export class Raycaster {
  constructor()
  setAssets({ textures, sprites })   // Map<string, canvas>; конвертировать в Uint32Array
  render(frame, scene)               // frame: ImageData 480×300 (писать строки 0..VIEW_H-1)
}
```
`scene = { map, px, py, pz, angle, pitch, entities, lightBoost, t }`
- `map` — GameMap (см. §15): `getWallTex(ix,iy)`, `getDoor(ix,iy)`, `getFloor(ix,iy)`,
  `getCeil(ix,iy)`, `getLight(ix,iy)`, `w`, `h`.
- `entities`: массив `{x, y, z, h, sprite, bright?, flip?}` — z это высота НИЗА
  спрайта над полом, h — высота в клетках; ширина = h * (canvasW/canvasH).
- `lightBoost` 0..0.6 — вспышка выстрела (добавить к свету, затухает с дистанцией).
- `t` — время в секундах (для лёгких эффектов, можно игнорировать).

Алгоритм (классика, lodev):
1. Камера через вектор направления и плоскость: `dir=(cos a, sin a)`,
   `plane = (-sin a, cos a) * tan(FOV/2)`.
2. Стены: DDA по сетке. Перпендикулярная дистанция (без рыбьего глаза).
   Высота колонны `colH = PROJ_DIST_RAYS / perpDist`, где PROJ_DIST_RAYS —
   проекционная константа для 480 колонок. Верх/низ с учётом pz и pitch:
   `horizon = VIEW_H/2 + pitch`; `top = horizon - (1-pz)*colH`; `bottom = horizon + pz*colH`.
3. **Двери** (`map.getDoor`): полотно в СЕРЕДИНЕ клетки. При входе DDA в дверную
   клетку продвинуть луч до средней плоскости клетки по оси двери; пусть `wallX` —
   дробная координата попадания вдоль полотна. Полотно уезжает вбок при открытии:
   если `wallX < door.openness` — луч проходит дальше (дверь там уже открыта),
   иначе текстурная координата `texX = wallX - door.openness`. Боковые откосы
   дверной ниши рисовать текстурой `SUPPORT`.
4. Тени по стороне: грань с попаданием по оси Y — множитель света 0.78.
5. Свет: `L = clamp(cellLight * (1 - perpDist/MAX_DIST) * side + lightBoost/(1+perpDist*0.5), 0, 1)`,
   квантовать на 16 ступеней (банding в духе Doom). Затемнение — умножение RGB.
6. Пол/потолок: per-pixel casting по строкам. Для строки y ниже горизонта:
   `rowDist = (pz * PROJ_DIST) / (y - horizon)`; выше: `rowDist = ((1-pz) * PROJ_DIST) / (horizon - y)`.
   Интерполяция мировой точки между крайними лучами строки. Текстура по
   `frac(wx), frac(wy)`, свет клетки * дистанционное затухание.
7. **Небо**: если `getCeil(ix,iy).tex === 'SKY'` — вместо потолка семплировать `SKY1`:
   `u = ((колоночный угол луча)/(2π)) * 1024 mod 1024` (поворот головы листает панораму,
   параллакса нет), `v` — линейно по строке от верха экрана к горизонту → 0..255.
   Небо НЕ затемнять светом и дистанцией.
8. Спрайты: сортировка по убыванию дистанции, проекция через обратную матрицу
   камеры, поколоночная отрисовка с z-буфером стен (`zbuf[480]` perpDist).
   Вертикаль: низ спрайта на высоте z, верх z+h (формулы как у стен через pz/horizon).
   `bright:true` — свет = 1 (минус лёгкое дистанционное затухание не применять).
   `flip` — зеркально по X. Альфа <128 — прозрачно (не писать пиксель).
9. Производительность: текстуры стен хранить колонко-мажорно (Uint32Array),
   спрайты — строко-мажорно. Никаких аллокаций в кадре. Один проход.
   Отсутствующий ключ текстуры/спрайта → один раз `console.warn` + шахматная
   магента-заглушка (НЕ исключение).

ВАЖНО: ImageData — little-endian ABGR (`0xAABBGGRR`). Альфа результата всегда 0xFF.

## §14. Уровень — js/game/level1.js [B2]

```js
export const LEVEL1 = {
  name: 'ТЕХБАЗА «ГЕФЕСТ-1»',
  w: 64, h: 64,
  walls: [ /* h строк ровно по w символов */ ],
  wallLegend: {
    '#': { kind: 'wall', tex: 'TECH1' },
    'D': { kind: 'door', tex: 'DOOR1' },
    'B': { kind: 'door', tex: 'DOORBLUE', key: 'blue' },
    'Y': { kind: 'door', tex: 'DOORYELL', key: 'yellow' },
    'R': { kind: 'door', tex: 'DOORRED', key: 'red' },
    'S': { kind: 'secret', tex: 'TECH1' },   // потайная дверь, выглядит как стена
    'E': { kind: 'exit', tex: 'SWEXIT_OFF' },
    // + любые свои символы для других текстур стен (METAL, CRATE, STONE, ...)
  },
  zones: [ /* h строк по w символов — пол/потолок/свет для КАЖДОЙ клетки */ ],
  zoneLegend: {
    'a': { floor: 'FLOOR_TECH', ceil: 'CEIL_TECH', light: 0.85 },
    's': { floor: 'NUKAGE', ceil: 'CEIL_TECH', light: 0.7, damage: 10 },
    'o': { floor: 'FLOOR_DIRT', ceil: 'SKY', light: 0.95 },
    'f': { floor: 'FLOOR_TECH', ceil: 'CEIL_TECH', light: 0.7, flicker: true },
    // ...
  },
  playerStart: { x: 0.5+ix, y: 0.5+iy, angle: 0 },
  things: [
    { type: 'imp', x: 10.5, y: 3.5, angle: Math.PI, skills: [2,3,4] },
    { type: 'medikit', x: 4.5, y: 8.5 },
    // angle только у монстров; skills опционально (по умолчанию [1,2,3,4])
  ],
};
```

Анимированные полы: в zoneLegend указывать БАЗОВОЕ имя (`NUKAGE`, `LAVA`) — кадры
подставит map.js. `'.'` в walls = пусто. Граница карты — сплошная стена.

Требования к дизайну (выполнить ВСЕ):
1. Прогрессия: старт (комната с пистолетными зомби) → коридоры → склад с ящиками →
   открытый двор (небо, импы на «балконах»-нишах) → крыло с синим ключом (засада) →
   синяя дверь → машинный зал (пулемёт, демоны) → кислотный резервуар с броней
   посреди (риск/награда) → жёлтый ключ с ловушкой (свет гаснет/флickер + спавн-ниши
   открываются заранее размещёнными монстрами за дверями) → жёлтая дверь → адская
   зона (BRICKRED/FLESH/MARBLE, лава, какодемоны) → зал барона → рубильник выхода.
2. Красный ключ спрятан нетривиально (ниша за секретом/в кислоте), красная дверь —
   хранилище с `pickup_bfg` + `armorblue`.
3. РОВНО 3 секрета (`kind:'secret'`): №1 — ниша с патронами и бронёй; №2 — комната
   с `soulsphere`; №3 — проход к красному ключу или хранилищу.
4. Оружие на уровне: дробовик рано (или с сержанта), `pickup_chaingun`,
   `pickup_rocketlauncher`, `pickup_plasmarifle` (можно в секрете №2), `pickup_bfg`
   (красное хранилище). Патронов щедро, всех типов.
5. Монстры: суммарно ≈30 на skills=1..2, ≈45 на 3, ≈55 на 4 (добавочные с
   `skills:[3,4]` и `skills:[4]`). Барон один, охраняет выход. Какодемоны 2–4
   в адской зоне/дворе.
6. Декор: 14–18 `barrel` (кластеры у врагов — тактика), лампы в техзонах, факелы
   в аду, 4–6 трупов, колонны. В тёмных коридорах света 0.3–0.45, в светлых 0.8–1.0,
   1–2 зоны с flicker.
7. Двери шириной 1 клетка, по бокам клетки `SUPPORT` или стены. Проходы основных
   маршрутов — ширина ≥2 клетки (двери — допустимое сужение до 1).
8. Каждая `thing` стоит на проходимой клетке ('.' в walls), не в стене, монстры
   не вплотную к дверям. Старт игрока — безопасная зона.
9. Уровень проходим: старт→(синий ключ)→синяя дверь→(жёлтый ключ)→жёлтая дверь→выход,
   без ключей этот маршрут не срезать. Самопроверка обязательна (мысленно пройти).
10. В конце файла приложить комментарий-карту с подписями областей.

## §15. GameMap API — js/game/map.js (интегратор; контракт для потребителей)

```js
export class GameMap {
  w; h;
  constructor(levelData)
  update(dt, game)                     // тайминги дверей, анимация текстур, фликер
  isSolid(ix, iy)                      // стена/закрытая дверь (openness<0.85)/выход/секрет; OOB=true
  isSolidAt(x, y)                      // то же по float-координатам
  isOpaque(ix, iy)                     // для LOS: дверь непрозрачна при openness<0.95
  getWallTex(ix, iy) -> string|null    // с учётом анимации (COMP) и выхода ON/OFF
  getDoor(ix, iy) -> {openness, state, tex, key, vertical, secret}|null
  getFloor(ix, iy) -> {tex, light, damage}   // tex с учётом анимации
  getCeil(ix, iy) -> {tex, light}            // tex может быть 'SKY'
  getLight(ix, iy) -> 0..1                   // с учётом фликера
  lineOfSight(x0, y0, x1, y1) -> bool
  raycastWall(x, y, dx, dy, maxDist) -> {dist, ix, iy} | null
  use(x, y, angle, game) -> bool       // дverь/секрет/выход перед игроком (дистанция ~1.1)
  monsterOpenDoor(ix, iy)              // монстры открывают двери без ключа
}
```
Двери: открытие за 1.0с, открыты 4с, закрытие 1.0с; не закрывается, если в клетке
кто-то стоит. Секрет — открывается медленнее, остаётся открытым, `game.foundSecret()`.

## §16. physics.js (готово — см. исходник js/engine/physics.js)

```js
export function moveWithCollision(map, x, y, dx, dy, radius) -> {x, y, collided}
export function entityBlocked(things, self, nx, ny) -> bool   // things: {x,y,radius,solid}
```
Перемещение по осям раздельно — скольжение вдоль стен.

## §17. Враги — js/game/enemies.js [B3]

Импорт: `../config.js`, `../engine/physics.js`.

```js
export const ENEMY_DEFS = { zombie: {...}, sergeant: {...}, imp: {...}, demon: {...}, cacodemon: {...}, baron: {...} };
export function createEnemy(type, x, y, angle) -> enemy
export function updateEnemy(e, game, dt)
export function damageEnemy(e, dmg, game, attacker)   // attacker: 'player' | enemy-объект
```

Поля enemy (читают движок и game): `type, x, y, z, angle, hp, state, sprite, radius,
h, solid, bright:false, awake, target, dead`. `sprite` — актуальный ключ кадра,
обновляется в updateEnemy. `target` — `'player'` или враг (infighting).

Параметры (взять из §25). Состояния:
- `idle`: стоит (walk0). Просыпается: (LOS до игрока И игрок в поле 200°) ИЛИ
  дистанция <2. Также от `game.noise` (см. §23). При пробуждении: звук
  `en_<type>_sight` (позиционный), state=chase.
- `chase`: движение к цели Doom-стилем: выбрать направление ≈ на цель (8 направлений),
  держать 0.35–0.6с, при блокировке (`moveWithCollision` collided или
  `entityBlocked`) — перебор соседних направлений. Монстр, упёршийся в дверь без
  ключа, вызывает `game.map.monsterOpenDoor`. Анимация walk 6 fps.
  Переход в атаку: melee если dist < 1.1; ranged если LOS && dist < 18 &&
  кулдаун истёк && шанс `dt * (1.2 * game.skillDef.aggro) * clamp(2 - dist/8, 0.4, 2)`.
- `attack`: стоит, кадры attack0..2 (общая длительность ~0.7с/def.attackTime).
  На кадре 1 — событие атаки: melee → `game.damagePlayer`/damageEnemy цели если
  всё ещё в радиусе 1.3; hitscan → `game.hitscan({owner:e, ...})` (разброс 4°);
  projectile → `game.spawnProjectile(def.projectile, ...)` в сторону цели (с upредить
  по z к центру цели). Звук `en_<type>_attack`. После — chase, кулдаун def.cooldown.
- `pain`: при уроне с шансом def.painChance — кадр pain0 на 0.35с, звук pain.
- `die`: die0..4 по 8 fps, звук die, solid=false; на die4 — state='dead', труп
  остаётся. `damageEnemy` при hp<=0: kills++ через game.stats, дроп (def.drops →
  `game.spawnItem(def.drops, e.x, e.y)`).
- Infighting: если attacker — враг (не игрок) и не тот же type, target=attacker.
  Цель умерла → target='player'.
- cacodemon: летает — z колеблется 0.15..0.3 (синус), игнорирует `entityBlocked`
  по наземным? НЕТ — упрощение: обычные коллизии, просто z-анимация парения.
- Урон по площади и кислота на врагов не действуют, кроме взрывов (game это решает).

Звуки врагов позиционные: `game.playSound(name, e.x, e.y)`.

## §18. Оружие игрока — js/game/weapons.js [B4]

Импорт: `../config.js`.

```js
export const WEAPON_DEFS = { fist:{slot:1,...}, pistol:{slot:2}, shotgun:{slot:3},
  chaingun:{slot:4}, rocketlauncher:{slot:5}, plasmarifle:{slot:6}, bfg:{slot:7} };
export class WeaponSystem {
  constructor(game)
  update(dt)                 // читает game.input.fire, game.input.weaponSelect, колесо
  switchTo(slotOrName)       // анимация опускания/подъёма (~0.25с каждая)
  get spriteKey()            // текущий ключ кадра 'wpn_..._idle'/'..._fire0'
  get offset()               // {x, y} качание+подъём в px канваса оружия
  get muzzleLight()          // 0..0.6 для scene.lightBoost
}
```

Дефиниции: `{slot, ammoType|null, ammoUse, damage:[min,max], pellets, spreadDeg,
fireTime, frames:[{key suffix, dur, fire?:true}], projectile|null, melee?:true,
sound, autoFire:bool}`. Параметры из §25.

Логика: state idle/raising/lowering/firing. Выстрел на кадре с `fire:true`:
- melee: `game.hitscan({range:1.2, ...})`, звук punch при попадании, swing при промахе.
- hitscan: `game.hitscan({damage, pellets, spreadDeg, owner:'player'})`, звук, отдача.
- projectile: `game.spawnProjectile(name, ...)` от глаз игрока с учётом pitch.
- BFG: звук wp_bfg на старте зарядки (кадры fire0..1 — зарядка 0.6с), снаряд на fire2.
Расход боеприпасов `game.player.ammo[type] -= ammoUse` (проверка ДО выстрела; если
не хватает — звук pl_noammo и автопереключение на лучшее доступное).
Качание (bob): синус от game.player.bobPhase, амплитуда ~7px по X, ~5px по Y.
1..7 — выбор, колесо — след./пред. доступное. Автоподъём лучшего при подборе делает
game (вызывает switchTo). Нельзя стрелять во время raising/lowering.

## §19. Игрок и ввод — js/game/player.js + js/engine/input.js [B5]

`js/engine/input.js`:
```js
export function createInput(canvas) -> input
// input: { forward, back, strafeL, strafeR, turnL, turnR, run, fire, use,
//   weaponSelect: null|1..7, wheelDelta: -1|0|1, mouseDx, mouseDy,
//   keysPressed: [],            // очередь e.code нажатий (для меню), сбрасывает потребитель
//   pointerLocked: bool,
//   requestLock(), exitLock(),
//   endFrame() }                // обнуляет mouseDx/Dy, wheelDelta, use=«нажатие», weaponSelect
```
Клавиши: WASD движение (A/D — стрейф), стрелки ←→ поворот, ↑↓ движение, Shift — бег,
E/Space — use (одноразовое нажатие, не удержание), Ctrl/ЛКМ — огонь (удержание),
1..7 — оружие, Tab — фиксируется в keysPressed (автокарта), Esc — НЕ перехватывать
preventDefault (нужен браузеру для pointer lock). preventDefault на Tab, Space,
стрелках, Ctrl. Мышь: movementX/Y при pointerLocked. Колесо — wheelDelta.
`use` и `weaponSelect` действуют один кадр (сбрасываются в endFrame).

`js/game/player.js` (импорт: config, physics):
```js
export function createPlayer(x, y, angle) -> p
// p: { x, y, angle, pitch, z, hp:100, armor:0, armorClass:0,  // 1=зел(1/3), 2=син(1/2)
//   ammo:{bullets:50,shells:0,rockets:0,cells:0}, weapons:{1:true,2:true},
//   keys:{blue:false,yellow:false,red:false}, alive:true,
//   bobPhase:0, vx:0, vy:0, faceEvent:null, lastDamageDir:0 }
export function updatePlayer(p, game, dt)   // движение/поворот/боб; use → game.useAction()
export function damagePlayer(p, dmg, game, srcX, srcY)  // броня, hp, faceEvent, звук, flash
export function addHealth(p, n, max=100) -> bool        // false если уже max (подбор не съедать)
export function addArmor(p, n, armorClass, max) -> bool
export function addAmmo(p, type, n) -> bool
export function giveWeapon(p, name) -> {taken:bool, isNew:bool}  // +стартовый боезапас оружия
```
Движение: ускорение ~36/с², экспоненциальное трение (~k=9/с), макс скорость
MOVE_SPEED (×RUN_MULT при беге). Поворот клавишами TURN_SPEED, мышью
`mouseDx * sens * 0.0022`. pitch мышью (если game.settings.mouseLook) ±MAX_PITCH,
клавишами нет. Боб: bobPhase += dt*9*(скорость/макс); z = EYE + sin(bobPhase)*0.02*факт.
Смерть: alive=false, z плавно к 0.16, pitch к 0. damagePlayer учитывает
`game.skillDef.dmgTaken` и броню: поглощение armorClass (1/3 или 1/2), броня тратится.

## §20. Шрифт — js/ui/font.js [F1]

```js
export const FONT_H = 7;
export function drawText(ctx, text, x, y, opts = {}) // {scale=1,color='#fff',align='left'|'center'|'right',alpha=1}
export function textWidth(text, scale=1) -> px
```
Бит-шрифт 5×7 (межбуквенный интервал 1px), глифы: А-Я, Ё, A-Z, 0-9, пробел,
`.,!?:;%/()+-='"«»_*№→`. Строчные приводить к прописным. Неизвестный глиф — пустой
квадрат. Данные глифов — компактные массивы строк-битмасок. Рисовать fillRect
по пикселям × scale. Шрифт должен быть читаемым и стильным (слегка «рубленый»,
как титры Doom): засечки не нужны, толщина 1px, диагонали разрешены.

## §21. HUD и автокарта — js/ui/hud.js [B6]

Импорт: `../config.js`, `./font.js`.

```js
export class HUD {
  constructor(sprites)            // Map спрайтов (лицо, ключи)
  draw(ctx, game, dt)             // нижняя панель 480×48 (y=252..300) + сообщения сверху
  drawAutomap(ctx, game)          // оверлей поверх вида (вызывается при game.automap)
}
```

Панель (рисуется кодом: тёмный металл, заклёпки, фаски панелей-углублений):
`ПАТР.` (крупно, текущий боезапас оружия; для кулака «—») | `ЗДОРОВЬЕ %` |
панель ARMS: цифры 2–7, подсвечены имеющиеся | ЛИЦО (по центру, 36×40) |
`БРОНЯ %` | 3 слота ключей (иконки hudkey_*) | мини-таблица боезапаса:
`ПУЛИ 50/200, ДРОБЬ 0/50, РАКЕТЫ 0/50, ЭНЕРГ 0/300` мелким шрифтом.
Числа — крупный шрифт scale 2, красный `#d23b1e`; здоровье <25 мигает.

Лицо: tier = по hp (80+:0, 60+:1, 40+:2, 20+:3, иначе 4); каждые 1.5–3с случайный
взгляд left/fwd/right; `game.player.faceEvent {type:'pain'|'grin', t}` приоритетнее
(посмотреть в сторону урона по lastDamageDir можно прямо/лево/право); мёртв — face_dead.

Сообщения: `game.messages` = [{text, t}] — рисовать до 3 строк сверху слева,
золотым (`#ffd24a`), scale 1, fade в последние 0.5с.

Автокарта: полупрозрачный чёрный фон (alpha 0.82) на области вида; масштаб — вписать
открытую часть, центр на игроке; рисуются ТОЛЬКО клетки из `game.visited`:
стены #9aa0ad, двери — цвет ключа (#4a90ff/#ffd24a/#ff4a4a, обычные #b8860b),
найденные секреты #3aa32a, игрок — зелёная стрелка по углу, название уровня внизу.

## §22. Меню — js/ui/menu.js [B7]

Импорт: `./font.js` (+ ничего больше из игры).

```js
export class Menu {
  constructor(sprites, sound, settings, callbacks)
  // callbacks: { onNewGame(skill), onResume, onQuitToMenu, onApplySettings() }
  mode   // 'title'|'main'|'skill'|'options'|'help'|'credits'|'pause'|'intermission'|'endtext'
  open(mode)
  setIntermission(stats)  // {kills, killsTotal, items, itemsTotal, secrets, secretsTotal, time, levelName}
  handleKey(code)         // 'ArrowUp'|'ArrowDown'|'Enter'|'Escape'|...
  draw(ctx, dt, t)        // 480×300; в 'pause' фон НЕ заливать полностью (игра просвечивает, затемнить alpha 0.6)
}
```

- `title`: title_bg, логотип сверху (лёгкое покачивание/пульс света), «НАЖМИТЕ ENTER»
  мигает, внизу «HELLBOUND v1.0 · КЛОН DOOM». Enter → main.
- `main`: НОВАЯ ИГРА / НАСТРОЙКИ / УПРАВЛЕНИЕ / ОБ ИГРЕ. Курсор — пульсирующий
  череп/метка слева. ↑↓ + Enter, Escape → title. Звуки menu_move/select/back.
- `skill`: «ВЫБЕРИТЕ СЛОЖНОСТЬ», 4 пункта из config.DIFFICULTY (имена) + строка-описание,
  курсор по умолчанию на 3-м. Enter → onNewGame(skill 1..4).
- `options`: слайдеры 0–10 ЗВУК / МУЗЫКА / ЧУВСТВ. МЫШИ (←→ меняют, сразу
  onApplySettings()), МЫШЬ: ОБЗОР ВКЛ/ВЫКЛ, НАЗАД. settings: {sfx, music, mouseSens, mouseLook}
  (sfx/music 0..1, mouseSens 0..1 → слайдер ×10).
- `help`: таблица управления (из §19) + «TAB — КАРТА, ESC — ПАУЗА».
- `credits`: «ОБ ИГРЕ»: оммаж DOOM (1993) id Software, сделано на чистом JS, 2026.
- `pause`: ПРОДОЛЖИТЬ / НАСТРОЙКИ / УПРАВЛЕНИЕ / В ГЛАВНОЕ МЕНЮ (+ Escape = resume).
  Подменю options/help из паузы возвращаются в pause (хранить стек/откуда пришли).
- `intermission`: inter_bg, «УРОВЕНЬ ПРОЙДЕН», имя уровня; строки УБИЙСТВА/ПРЕДМЕТЫ/
  ТАЙНИКИ с процентами, считающимися вверх ~1.2с (звук тиков — menu_move каждые ~0.1с),
  ВРЕМЯ m:ss; «ENTER — ДАЛЬШЕ» → onNewGame? НЕТ: main.js сам слушает и переводит в endtext.
  Enter обрабатывает main через handleKey → menu возвращает спец-результат? Упростить:
  handleKey при Enter в intermission вызывает callbacks.onIntermissionDone() —
  добавить в callbacks.
- `endtext`: на чёрном, печатающийся текст (как финал эпизода Doom):
  «Станция „Гефест-1" зачищена. Но сканеры ловят сигналы из глубины: портал
  всё ещё открыт. Это была только разминка...» + «ENTER — В МЕНЮ» (onQuitToMenu).

Вся отрисовка — font.drawText + пиксельные украшения (рамки, черепа-курсоры рисовать
кодом). Выглядеть должно как настоящий титульный экран, не как HTML-страница.

## §23. game.js API (доступно B3, B4, B5, B6 через объект game)

```js
game.map, game.player, game.weaponSys, game.input, game.settings
game.difficulty (1..4), game.skillDef          // DIFFICULTY[difficulty]
game.enemies[], game.items[], game.decor[], game.projectiles[], game.effects[]
game.time, game.automap (bool), game.visited (Set "ix,iy"), game.messages
game.stats = { kills, killsTotal, items, itemsTotal, secrets, secretsTotal }
game.over (bool), game.won (bool)
game.message(text)
game.playSound(name, x?, y?)                   // с коорд. — позиционный (затухание/пан)
game.noise(x, y)                               // будит врагов: dist<12 с LOS, или dist<6
game.hitscan({x, y, z, angle, dz=0, damage:[min,max], pellets=1, spreadDeg=0, range=24, owner})
   // owner: 'player' | enemy; попадание: кровь+урон, мимо: puff на стене
game.spawnProjectile(type, x, y, z, angle, dz, owner)
game.spawnItem(type, x, y)
game.spawnEffect(type, x, y, z)                // тип из EFFECT_DEFS
game.explode(x, y, damage, radius, owner)      // сплэш: враги, игрок, бочки; LOS-проверка
game.damagePlayer(dmg, srcX?, srcY?)
game.flash(r, g, b, a)  game.shake(power)
game.useAction()                               // делегирует map.use, сообщения «Нужен … ключ»
game.foundSecret()                             // секрет: stats, звук, сообщение
game.endLevel()                                // рубильник выхода
```

## §24. main.js — состояния приложения (информативно)

`APP: 'menu' | 'game' | 'pause' | 'intermission' | 'endtext'`. Игра стартует из
menu.skill → создаётся Game. Esc/потеря pointer lock в игре → pause. Смерть — внутри
game (оверлей «ВЫ ПОГИБЛИ — ENTER», Enter → рестарт уровня). Выход с уровня →
melt-переход → intermission → endtext → title. Melt-эффект (колонны экрана «стекают»)
на переходах menu→game и game→intermission. Настройки в localStorage. `?debug` — FPS.
Музыка: menu/title — 'menu', игра — 'level', intermission/endtext — 'victory'.

## §25. Баланс (числа — истина в последней инстанции)

Враги:

| type | hp | speed | radius | h | атака | урон | cooldown | painChance | drops |
|---|---|---|---|---|---|---|---|---|---|
| zombie | 20 | 1.6 | 0.3 | 0.78 | hitscan ×1 | 3–15 | 1.6с | 0.7 | ammo_clip |
| sergeant | 30 | 1.7 | 0.3 | 0.78 | hitscan ×3 (разброс 6°) | 3–15 кажд. | 2.1с | 0.65 | pickup_shotgun |
| imp | 60 | 1.7 | 0.33 | 0.82 | projectile `fireball` / melee 3–24 | — | 1.9с | 0.5 | — |
| demon | 150 | 2.9 | 0.4 | 0.8 | melee | 4–40 | 1.0с | 0.45 | — |
| cacodemon | 400 | 1.7 | 0.45 | 0.62 (z парит 0.15–0.3) | projectile `cacoball` | — | 1.8с | 0.5 | — |
| baron | 700 | 1.5 | 0.45 | 0.95 | projectile `baronball` / melee 10–60 | — | 1.5с | 0.2 | — |

Оружие (fireTime = полный цикл):

| name | slot | ammo | расход | урон | pellets | разброс | fireTime | auto |
|---|---|---|---|---|---|---|---|---|
| fist | 1 | — | 0 | 8–24 | 1 | 0 | 0.5с | нет |
| pistol | 2 | bullets | 1 | 5–15 | 1 | 2.2° | 0.45с | да |
| shotgun | 3 | shells | 1 | 5–15 | 7 | 5.5° | 1.05с | нет |
| chaingun | 4 | bullets | 1 | 5–15 | 1 | 3.5° | 0.12с | да |
| rocketlauncher | 5 | rockets | 1 | projectile `rocketproj` | — | 0 | 0.9с | да |
| plasmarifle | 6 | cells | 1 | projectile `plasmaball` | — | 1.5° | 0.11с | да |
| bfg | 7 | cells | 40 | projectile `bfgball` | — | 0 | 1.8с | нет |

Стартовый боезапас оружия при подборе: shotgun +8 shells, chaingun +20 bullets,
rocketlauncher +2 rockets, plasmarifle +40 cells, bfg +40 cells. С сержанта
дробовик даёт +4 shells. ammoMult сложности умножает ЛЮБОЙ подбор патронов.

Предметы: stimpack +10hp(до 100), medikit +25(до 100), healthbonus +1(до 200),
soulsphere +100(до 200), armorbonus +1 брони(до 200, класс не ниже 1),
armorgreen =100 (класс 1: поглощает 1/3), armorblue =200 (класс 2: 1/2),
clip +10, bulletbox +50, shells +4, shellbox +20, rocket +1, rocketbox +5,
cell +20, cellpack +100. Бочка: hp 20, взрыв 80 урона, радиус 1.5, цепная реакция.

## §26. Чеклист качества (перед сдачей любого модуля)

- `node --check <файл>` проходит (ESM).
- Экспорты и ключи — точно по контракту, ни одного отсутствующего ключа.
- Нет TODO, заглушек, console.log, мёртвого кода.
- Ассеты: посмотреть «глазами игрока 1993» — никакой программистской геометрии
  из трёх прямоугольников; у объектов объём, тени, детали.
- Логика: никакой возможности исключения в кадровом цикле (защита от null).

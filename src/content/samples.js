// The two built-in sample stories.
import { chaptersFromParas } from '../engine/parser/structure.js';
import { textToParas } from '../engine/parser/text.js';
import { detectTheme } from '../engine/parser/detect.js';
import { lsGet, words } from '../lib/utils.js';

/* ============================== Samples (original stories) ============================== */
export const SAMPLES = [
  {
    id: 'sample-vellmoor',
    title: 'The Lanterns of Vellmoor',
    author: 'An Inkworlds original',
    text: `CHAPTER I

ELEANOR ASHFORD'S JOURNAL

14 October. Vellmoor.—Arrived at dusk after a jolting ride across the moor, the coachman refusing to take the last mile in darkness. He set me down at the crossroads with my trunk and would not meet my eye when I asked him why. The house stands on a rise above the village, black against a sky the colour of pewter, and every window but one was dark.

The housekeeper, Mrs. Greaves, received me with a candle and very few words. She told me my uncle keeps to his rooms after nightfall and that I must do the same. When I asked about the lanterns I had seen moving along the churchyard wall, she only said that they belong to the old chapel, and that they are not my concern.

15 October.—Slept badly. Twice I woke to the sound of something tapping at the glass, patient and rhythmic, like a fingernail. In the morning I found the sill outside my window scattered with small dead moths, all turned the same way, all facing the chapel.

LETTER FROM ELEANOR ASHFORD TO MISS CLARA DENE.

My dearest Clara,

You made me promise to write the moment I arrived, and so I am keeping my word, though I hardly know what to tell you. The house is grand and cold and full of clocks that have all stopped at a quarter past three. My uncle has not yet come down to see me.

Do you remember how we used to laugh at the ghost stories old Mr. Pell told at school? I find I am not laughing now. There are lanterns on the moor at night, Clara, and no one here will say who carries them.

Write to me soon, and write of ordinary things. I think I shall need them.

Your loving friend,

ELEANOR.

CHAPTER II

The storm came in off the moor on the third night, and with it the lanterns. Eleanor watched them from the landing window: a slow procession of pale lights, swaying as if carried by walkers who did not need to watch their feet. The wind howled in the chimneys and the rain lashed the glass until the whole house seemed to shudder.

At midnight the thunder broke directly overhead, and in the white glare of the lightning she saw the chapel door standing open. The rain drove across the graves in grey sheets. Somewhere below her a clock that had not moved in years began, very slowly, to tick.

TELEGRAM, DR. HALLORAN TO ELEANOR ASHFORD.

Do not go to the chapel after dark. Arriving Thursday by the last train. Say nothing to the household.

CUTTING FROM THE VELLMOOR GAZETTE, 19 OCTOBER.

The storm of Tuesday night has left the parish with considerable damage. Several trees were brought down upon the moor road, and the roof of the old chapel of St. Aldric is reported to have partly collapsed under the force of the wind.

Curiously, three residents of the village report having seen lights moving near the chapel during the height of the storm, although the building has been locked and unused these forty years. The sexton, questioned on the matter, declined to comment.

CHAPTER III

Dr. Halloran arrived on Thursday as he had promised, grey with travel and carrying a leather case he would not let the porter touch. He listened to everything Eleanor told him without once interrupting, and when she had finished he asked only one question: had she counted the lanterns?

She had. There were thirteen. On the first night there had been twelve.

They went to the chapel together at sunrise, when the moor was silver with frost and the last of the storm had blown itself out. Inside, among the fallen slates, they found the lanterns set in a careful ring on the stone floor, cold and empty, their glass fogged with a fine grey dust. In the centre of the ring lay a small brass key.

Eleanor picked it up. It was warm, as though someone had held it in their hand all night. Outside, the morning sun broke over the moor, golden and bright, and somewhere below in the village a church bell began to ring for the first time in forty years.`
  },
  {
    id: 'sample-cartographer',
    title: "The Cartographer's Apprentice",
    author: 'An Inkworlds original',
    text: `CHAPTER I

Wren had been apprenticed to the wizard Aldous Fenn for exactly one year before he let her touch the enchanted maps. They hung in the tower workshop like sleeping bats, rolled and tied with silver thread, and each one hummed faintly when she walked past, the way a kettle hums just before it begins to sing.

"A map," Master Fenn liked to say, "is only a spell that has learned to sit still." He drew his with ink ground from river stones and a quill cut from the feather of a storm-owl, and when he finished a map, the land it showed would quietly rearrange itself to agree with him.

This worried Wren more than she let on. She had seen a village move half a mile to the east because he had smudged a line. She had seen a river change its mind.

On the morning of her first lesson she found a folded note waiting on her workbench, pinned beneath a jar of glowing blue ink.

Dear Wren,

Called away to the Council of Mages; back by the new moon. You may practise on the small map of the orchard, and only the orchard. Do not, under any circumstances, draw a door.

Yours in ink and starlight,

Master Aldous Fenn

CHAPTER II

She lasted until the third day.

It was a very small door, drawn in the corner of the orchard map beside the oldest apple tree, and she only meant to see whether the magic would take. For a long moment nothing happened. Then the ink shivered, the parchment grew warm beneath her fingers, and from somewhere far below the tower came the unmistakable sound of a latch lifting.

Wren ran down the spiral stair and out into the orchard. The morning sun was bright on the grass, the bees were busy in the blossom, and beside the oldest apple tree, where yesterday there had been nothing at all, stood a green wooden door in a frame of living bark.

It was slightly open. Beyond it she could see stars.`
  }
];
export const sampleCache = new Map();
export function sampleData(s) {
  if (!sampleCache.has(s.id)) {
    const chapters = chaptersFromParas(textToParas(s.text)),
      det = detectTheme(chapters),
      saved = lsGet('iw:sampletheme:' + s.id, null);
    sampleCache.set(s.id, {
      meta: {
        id: s.id,
        title: s.title,
        author: s.author,
        auto: det.theme,
        hits: det.hits,
        theme: saved || 'auto',
        words: words(s.text),
        chapters: chapters.length,
        sample: true,
        added: 0
      },
      chapters
    });
  }
  return sampleCache.get(s.id);
}

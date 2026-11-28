/** Bilingual text: every player-facing string is shown in English and Hebrew together. */
export interface Bi {
  en: string;
  he: string;
}

export const bi = (en: string, he: string): Bi => ({ en, he });

export const T = {
  loading: bi('Gathering meteor dust…', 'אוספים אבק מטאורים…'),
  tagline: bi('The bandits burned your village. The meteor chose you.', 'השודדים שרפו את הכפר שלכם. המטאור בחר בכם.'),
  start: bi('Start', 'התחלה'),
  continue: bi('Continue', 'המשך'),
  newGame: bi('New game', 'משחק חדש'),
  resume: bi('Resume', 'חזרה למשחק'),
  quit: bi('Quit to title', 'יציאה למסך הפתיחה'),
  paused: bi('Paused', 'השהיה'),
  backToTitle: bi('Back to title', 'חזרה למסך הפתיחה'),
  skip: bi('Skip', 'דילוג'),
  replayIntro: bi('Watch the opening', 'צפייה בפתיחה'),
  titleNote: bi(
    'Test build · needs a keyboard or gamepad · about 10–15 minutes · progress saves at campfires',
    'גרסת בדיקה · נדרשים מקלדת או בקר · כ־10–15 דקות · ההתקדמות נשמרת ליד מדורות',
  ),
  titleNoteTouch: bi(
    'Test build · touch controls · best in landscape · about 10–15 minutes · progress saves at campfires',
    'גרסת בדיקה · שליטה במגע · עדיף לרוחב · כ־10–15 דקות · ההתקדמות נשמרת ליד מדורות',
  ),
  emberSiphon: bi('Ember Siphon', 'ספיגת רשף'),
  kineticSurge: bi('Kinetic Surge', 'הדף קינטי'),
  muted: bi('muted', 'מושתק'),
  endTitle: bi('End of the test build', 'סוף גרסת הבדיקה'),
  endText: bi(
    'The patrol camp has fallen. The bandit fortress, and the meteor machine, wait beyond the hills.',
    'מחנה הסיור נפל. מצודת השודדים, ומכונת המטאור, מחכות מעבר לגבעות.',
  ),
  time: bi('time', 'זמן'),
  falls: bi('falls', 'נפילות'),
  heartShards: bi('heart shards', 'רסיסי לב'),
  thanks: bi('Thanks for playing! Tell us where you got stuck and what felt great.', 'תודה ששיחקתם! ספרו לנו איפה נתקעתם ומה הרגיש מעולה.'),
  touch: {
    jump: bi('Jump', 'קפיצה'),
    siphon: bi('Siphon', 'ספיגה'),
    release: bi('Fire', 'אש'),
    dash: bi('Dash', 'זינוק'),
  },
  touchHint: bi(
    'Left thumb: drag anywhere to move (up/down to aim, down + Jump to drop). Right thumb: Jump, Siphon, Fire, Dash.',
    'אגודל שמאל: גררו בכל מקום כדי לזוז (למעלה/למטה לכיוון, למטה + קפיצה לירידה). אגודל ימין: קפיצה, ספיגה, אש, זינוק.',
  ),
  rotate: bi('Turn your phone sideways to play', 'סובבו את הטלפון לרוחב כדי לשחק'),
  toast: {
    beacons: [bi('The beacons answer', 'המשואות עונות'), bi('Somewhere a stone door grinds open.', 'איפשהו נפתחת דלת אבן בחריקה.')],
    kinetic: [
      bi('Kinetic Surge awakened', 'ההדף הקינטי התעורר'),
      bi(
        'Press Shift or K to dash, even in mid-air. Dash into cracked walls and shielded bandits.',
        'לחצו Shift או K כדי לזנק, גם באוויר. זנקו אל קירות סדוקים ואל שודדים עם מגן.',
      ),
    ],
    heart: [bi('Heart shard', 'רסיס לב'), bi('Your maximum health grows by one.', 'החיים המרביים שלכם גדלים באחד.')],
    campfire: [
      bi('Rested at the campfire', 'מנוחה ליד המדורה'),
      bi('Progress saved. You will return here if you fall.', 'ההתקדמות נשמרה. תחזרו לכאן אם תיפלו.'),
    ],
    gate: [
      bi('The gate breaks open', 'השער נפרץ'),
      bi('The patrol is scattered. The road to the fortress lies ahead.', 'הסיור התפזר. הדרך אל המצודה פתוחה לפניכם.'),
    ],
  },
  controls: [
    [bi('Move', 'תנועה'), 'A / D  ·  ← / →', null],
    [bi('Jump', 'קפיצה'), 'Space · Z', bi('hold for higher', 'החזיקו לקפיצה גבוהה')],
    [bi('Siphon fire', 'ספיגת אש'), 'E · J', bi('tap near fire or an incoming fire arrow', 'הקישו ליד אש או מול חץ בוער')],
    [bi('Release fireball', 'שחרור כדור אש'), 'F · L', bi('hold W/S or ↑/↓ to aim', 'כוונו עם W/S או ↑/↓')],
    [bi('Kinetic Surge dash', 'זינוק הדף קינטי'), 'Shift · K', bi('once you find it', 'אחרי שתמצאו אותו')],
    [bi('Drop through planks', 'ירידה דרך קורות'), 'S / ↓ + Jump', null],
    [bi('Pause', 'השהיה'), 'Esc · P', null],
    [bi('Mute', 'השתקה'), 'M', null],
    [bi('Gamepad', 'בקר'), 'A · X · Y/RB · B/LB', bi('jump · siphon · release · dash', 'קפיצה · ספיגה · שחרור · זינוק')],
  ] as [Bi, string, Bi | null][],
  intro: [
    bi('At the edge of the Glowing Forest lay a quiet village.', 'בקצה היער הזוהר שכן כפר שקט.'),
    bi('Then the bandits came, hunting meteor stones to fuel their war machines.', 'ואז הגיעו השודדים, בחיפוש אחר אבני מטאור שיניעו את מכונות המלחמה שלהם.'),
    bi('They found nothing. So they burned everything.', 'הם לא מצאו דבר. אז הם שרפו הכול.'),
    bi('That night, a star fell.', 'באותו לילה, נפל כוכב.'),
    bi("It did not fall into the bandits' hands. It fell into yours.", 'הוא לא נפל לידי השודדים. הוא נפל לידיים שלכם.'),
    bi('Absorb the world’s energy. Release it. Take back what was burned.', 'ספגו את אנרגיית העולם. שחררו אותה. השיבו את מה שנשרף.'),
  ],
};

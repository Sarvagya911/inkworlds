// // Reader toolbar and settings panel wiring.
// import { saveMeta, themeOf } from '../app/books.js';
// import { enc } from '../app/helpers.js';
// import { changePrefs } from '../app/sync.js';
// import { Ambience } from '../engine/ambience.js';
// import { Main } from '../engine/scenes/stage.js';
// import { $, prefs } from '../lib/utils.js';
// import { hideSelPop } from './annotations.js';
// import { renderTab } from './drawer.js';
// import { onScroll } from './position.js';
// import { applyReaderPrefs, applyTheme, closePanels, cur, updateWhy } from './reader.js';

// $('backBtn').addEventListener('click', () => {
//   location.hash = '#/book/' + enc(cur.meta.id);
// });

// $('tocBtn').addEventListener('click', () => {
//   const open = !$('drawer').classList.contains('open');
//   closePanels();
//   if (open) {
//     $('drawer').classList.add('open');
//     $('scrim').hidden = false;
//     $('tocBtn').setAttribute('aria-expanded', 'true');
//     renderTab();
//     const f =
//       $('tabBody').querySelector('[aria-current="true"]') || $('tabBody').querySelector('button,input');
//     f && f.focus();
//   }
// });

// $('setBtn').addEventListener('click', () => {
//   const open = $('sheet').hidden;
//   closePanels();
//   if (open) {
//     $('sheet').hidden = false;
//     $('scrim').hidden = false;
//     $('setBtn').setAttribute('aria-expanded', 'true');
//     $('themeSel').focus();
//   }
// });

// $('scrim').addEventListener('click', closePanels);

// addEventListener('keydown', e => {
//   if (e.key === 'Escape') {
//     closePanels();
//     hideSelPop();
//   }
// });

// addEventListener(
//   'scroll',
//   () => {
//     onScroll();
//     if (!$('selpop').hidden) hideSelPop();
//   },
//   { passive: true }
// );

// $('themeSel').addEventListener('change', async e => {
//   cur.meta.theme = e.target.value;
//   cur.meta.aiReason = '';
//   await saveMeta(cur.meta);
//   applyTheme(themeOf(cur.meta));
//   updateWhy();
// });

// $('fsRange').addEventListener('input', e => {
//   changePrefs({ fs: +e.target.value });
//   applyReaderPrefs();
// });

// $('volRange').addEventListener('input', e => {
//   changePrefs({ vol: +e.target.value });
//   Ambience.volume();
// });

// $('handAll').addEventListener('change', e => {
//   changePrefs({ handAll: e.target.checked });
//   applyReaderPrefs();
// });

// $('motionOn').addEventListener('change', e => {
//   changePrefs({ motion: e.target.checked });
//   if (prefs.motion) Main.start();
//   else Main.stop();
// });



// Reader toolbar and settings panel wiring.

import { saveMeta, themeOf } from '../app/books.js';
import { enc } from '../app/helpers.js';
import { changePrefs } from '../app/sync.js';
import { Ambience } from '../engine/ambience.js';
import { Main } from '../engine/scenes/stage.js';
import { $, prefs } from '../lib/utils.js';
import { hideSelPop } from './annotations.js';
import { renderTab } from './drawer.js';
import { onScroll } from './position.js';
import {
  applyReaderPrefs,
  applyTheme,
  closePanels,
  cur,
  updateWhy
} from './reader.js';


/* ---------------------------------------------------------
 * Mobile bottom-sheet swipe-to-close
 * --------------------------------------------------------- */

const swipeSheet = $('sheet');
const sheetHandle = $('sheetHandle');

if (swipeSheet && sheetHandle) {
  let dragging = false;
  let startY = 0;
  let currentY = 0;
  let pointerId = null;

  sheetHandle.addEventListener(
    'pointerdown',
    e => {
      dragging = true;
      pointerId = e.pointerId;

      startY = e.clientY;
      currentY = e.clientY;

      sheetHandle.setPointerCapture(
        e.pointerId
      );

      swipeSheet.style.transition = 'none';
      swipeSheet.style.willChange = 'transform';

      e.preventDefault();
    }
  );


  sheetHandle.addEventListener(
    'pointermove',
    e => {
      if (
        !dragging ||
        e.pointerId !== pointerId
      ) {
        return;
      }

      currentY = e.clientY;

      const distance =
        Math.max(
          0,
          currentY - startY
        );

      e.preventDefault();

      swipeSheet.style.transform =
        `translate3d(0, ${distance}px, 0)`;
    },
    { passive: false }
  );


  function finishSheetDrag(e) {
    if (
      !dragging ||
      (e && e.pointerId !== pointerId)
    ) {
      return;
    }

    if (e) {
      currentY = e.clientY;
    }

    dragging = false;

    const distance =
      Math.max(
        0,
        currentY - startY
      );

    if (
      pointerId !== null &&
      sheetHandle.hasPointerCapture(pointerId)
    ) {
      try {
        sheetHandle.releasePointerCapture(
          pointerId
        );
      } catch (_) {
        // Pointer may already have been released.
      }
    }

    pointerId = null;

    swipeSheet.style.transition =
      'transform 180ms cubic-bezier(.22, 1, .36, 1)';

    if (distance > 90) {
      swipeSheet.style.transform =
        'translate3d(0, 100%, 0)';

      setTimeout(() => {
        swipeSheet.style.transform = '';
        swipeSheet.style.transition = '';
        swipeSheet.style.willChange = '';

        closePanels();
      }, 180);

      return;
    }

    swipeSheet.style.transform =
      'translate3d(0, 0, 0)';

    setTimeout(() => {
      swipeSheet.style.transform = '';
      swipeSheet.style.transition = '';
      swipeSheet.style.willChange = '';
    }, 180);
  }


  sheetHandle.addEventListener(
    'pointerup',
    finishSheetDrag
  );


  sheetHandle.addEventListener(
    'pointercancel',
    finishSheetDrag
  );
}


/* ---------------------------------------------------------
 * Back button
 * --------------------------------------------------------- */

$('backBtn').addEventListener(
  'click',
  () => {
    location.hash =
      '#/book/' + enc(cur.meta.id);
  }
);


/* ---------------------------------------------------------
 * Drawer
 * --------------------------------------------------------- */

$('drawerClose').addEventListener(
  'click',
  closePanels
);


$('tocBtn').addEventListener(
  'click',
  () => {
    const open =
      !$('drawer').classList.contains('open');

    closePanels();

    if (open) {
      $('drawer').classList.add('open');
      $('scrim').hidden = false;

      $('tocBtn').setAttribute(
        'aria-expanded',
        'true'
      );

      renderTab();

      const f =
        $('tabBody').querySelector(
          '[aria-current="true"]'
        ) ||
        $('tabBody').querySelector(
          'button,input'
        );

      f && f.focus();
    }
  }
);


/* ---------------------------------------------------------
 * Reading settings
 * --------------------------------------------------------- */

$('setBtn').addEventListener(
  'click',
  () => {
    const open =
      $('sheet').hidden;

    closePanels();

    if (open) {
      $('sheet').hidden = false;
      $('scrim').hidden = false;

      $('setBtn').setAttribute(
        'aria-expanded',
        'true'
      );

      $('themeSel').focus();
    }
  }
);


/* ---------------------------------------------------------
 * Scrim / Escape
 * --------------------------------------------------------- */

$('scrim').addEventListener(
  'click',
  closePanels
);


addEventListener(
  'keydown',
  e => {
    if (e.key === 'Escape') {
      closePanels();
      hideSelPop();
    }
  }
);


/* ---------------------------------------------------------
 * Reader scroll
 * --------------------------------------------------------- */

addEventListener(
  'scroll',
  () => {
    onScroll();

    if (!$('selpop').hidden) {
      hideSelPop();
    }
  },
  { passive: true }
);


/* ---------------------------------------------------------
 * World / theme
 * --------------------------------------------------------- */

$('themeSel').addEventListener(
  'change',
  async e => {
    cur.meta.theme =
      e.target.value;

    cur.meta.aiReason = '';

    await saveMeta(cur.meta);

    applyTheme(
      themeOf(cur.meta)
    );

    updateWhy();
  }
);


/* ---------------------------------------------------------
 * Text size
 * --------------------------------------------------------- */

$('fsRange').addEventListener(
  'input',
  e => {
    changePrefs({
      fs: +e.target.value
    });

    applyReaderPrefs();
  }
);


/* ---------------------------------------------------------
 * Sound volume
 * --------------------------------------------------------- */

$('volRange').addEventListener(
  'input',
  e => {
    changePrefs({
      vol: +e.target.value
    });

    Ambience.volume();
  }
);


/* ---------------------------------------------------------
 * Page opacity
 *
 * Updates:
 * 1. The saved preference
 * 2. The actual reader surface
 * 3. The percentage label immediately
 *    while the slider is being dragged
 * --------------------------------------------------------- */

$('opacityRange').addEventListener(
  'input',
  e => {
    const value =
      Math.max(
        0,
        Math.min(
          100,
          +e.target.value
        )
      );

    changePrefs({
      pageOpacity: value,
      pageOpacitySet: true
    });

    applyReaderPrefs();

    /*
     * Update whichever percentage element
     * exists in the settings UI.
     *
     * Supports either:
     *   #opacityValue
     * or
     *   #opacityLabel
     */
    const valueEl =
      $('opacityValue') ||
      $('opacityLabel');

    if (valueEl) {
      valueEl.textContent =
        `${value}%`;
    }
  }
);


/* ---------------------------------------------------------
 * Handwritten mode
 * --------------------------------------------------------- */

$('handAll').addEventListener(
  'change',
  e => {
    changePrefs({
      handAll: e.target.checked
    });

    applyReaderPrefs();
  }
);


/* ---------------------------------------------------------
 * Background animation
 * --------------------------------------------------------- */

$('motionOn').addEventListener(
  'change',
  e => {
    changePrefs({
      motion: e.target.checked
    });

    if (prefs.motion) {
      Main.start();
    } else {
      Main.stop();
    }
  }
);
// Book card used on Discover and community pages.
import { themeOf } from '../app/books.js';
import { enc, nameOf, nl } from '../app/helpers.js';
import { THEMES, fontStack } from '../config/themes.js';
import { esc } from '../lib/utils.js';

export function bookCard(b, ppl) {
  const key = themeOf(b),
    th = THEMES[key];
  return `<a class="bcard" href="#/book/${enc(b.id)}"><div class="bcover" style="--s1:${th.spine[0]};--s2:${th.spine[1]};--s3:${th.spine[2]};--sf:${esc(fontStack(th.title, 'title'))}">${esc(b.title)}</div>
    <div class="binfo"><b>${esc(b.title)}</b><span class="by">${b.author ? esc(b.author) + '. ' : ''}${esc(th.name)}</span>
    <span class="by">${b.sample ? 'Inkworlds sample' : `Shared by ${esc(nameOf(ppl, b.ownerId))}`}${b.likeCount ? `. ${b.likeCount} like${b.likeCount === 1 ? '' : 's'}` : ''}${b.commentCount ? `. ${b.commentCount} comment${b.commentCount === 1 ? '' : 's'}` : ''}</span>${b.desc ? `<p>${nl(b.desc)}</p>` : ''}</div></a>`;
}

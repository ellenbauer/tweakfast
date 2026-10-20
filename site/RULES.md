# Tweakfast rules for site generators

One screen. Follow it and the owner can keep the site current by clicking.

## What the owner can do

- Click any text once to pick it, again to type. A link or button shows where it goes; type a new address. Selected words can become a link.
- Click a picture and choose another one. It takes the old picture's frame. A field under it holds what the picture shows (the alt text). A logo drawn as inline SVG and a box painted by CSS can take a picture too.
- Drag a block to another place, hide it, remove it, copy it. Add one more of a repeated item. A button is a block of its own: copy it, remove it, move it beside its neighbours.
- Swap the two halves of a block that has two big parts side by side (a picture and words). On a phone they stack in the page's own order.
- Give a block another background the site already has (a class that only sets a background, like `.section-dark`).
- Give a button the look of another button on the page (the quieter one, the outlined one).
- Add a page like an existing one. Rename, reorder, hide or remove a page. Give a page its title and description for Google. Undo. Done saves, live. Every saved version of a page can be brought back.

Nothing else. No new colours, fonts, sizes or kinds of blocks: the owner only picks among the looks you made. Those stay with you.

## How the site is read

- The menu is the first `<nav>` with links, inside `<header>` when there is one. Pages are its links to `name.html`, `./` or `/`. The first link in the header is Home; it cannot be hidden.
- Blocks are the direct children of `<main>`. Repeated items are siblings with the same tag and classes, for example `<article class="card">` inside a grid or `<li>` in a list.
- Text is any element that holds words and only inline elements (`a`, `span`, `strong`, `em`, `small`, `cite`, `br`, `time` and the like): headings, paragraphs, list items, table cells, a `<div>` of words. A word inside a link inside a paragraph edits the paragraph.
- Pictures are `<img>` elements. A background picture set in CSS is not replaced; a box of at least 120 by 120 pixels with no words in it gets a picture laid over it.
- The header that holds the menu and every footer are shared: a change there is made on every page at once. The menu's links are renamed, ordered and hidden from the Site panel, not by clicking them.

## Write the site so this works

- One `<main>` per page, blocks as its direct children, nothing floating outside it.
- Shared header, menu and footer repeated on every page with the same markup.
- Relative links between pages: `about.html`, not `/about` and not a router.
- Pictures as `<img src="pictures/name.jpg" alt="...">` in a frame whose size CSS sets. The owner's new picture fills the same frame.
- A list of similar things is a list of identical items. Dates in `<time>`.
- Words in the HTML, never in CSS `content`: words drawn by CSS cannot be edited.
- Buttons that belong together sit in one element that sets the gap between them.
- Two halves side by side are two direct children of one grid or flex row.
- A section's background variants are classes that set only the background and the text colour (`.section-dark`). Grey words, lines and hover shades inside are best made from that pair (`currentColor`, `color-mix`); others the editor turns to the new background itself. A part on a colour of its own (a lime note) sets its own text colour.
- One line before `</body>` on every page: `<script src="/tweakfast.js"></script>`.

## Three attributes when the reading guesses wrong

- `data-tf="fixed"` on anything that must not change (a legal line, a price table).
- `data-tf="text"` on an element that holds text the owner should edit but is not in the list above.
- `data-tf="block"` on an element that should move, hide and copy as a block but is nested deeper than a direct child of `<main>`.

## Check your work

Open any page with `#edit=test` and move the mouse over it: a thin line shows what the owner can change, with a tag where the eye cannot tell (Link, Picture), a block shows its tools at its top right, and fixed parts show nothing. Fix the markup until it shows what you meant. Then publish with `npx github:ellenbauer/tweakfast <site folder>`; it prints the owner's link. It takes out any scripts and badges a tool attached, so the site needs none of its own. Setup for the maker is in SETUP.md.

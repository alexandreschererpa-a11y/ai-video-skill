# Your own mascot (image presenter)

A mascot is a character made of images (a 2D cartoon, a voxel figure, an animal...) that hosts the user's reels instead of the
drawn presenter. People remember a character faster than a face, and it looks the same in every video. It is saved once in
`~/.config/ai-video/mascots/<name>/` and works in every project and folder.

Where it works: **classic** reels (it replaces the drawn bust bottom-right and takes the same acting: `act()` states become poses)
and **carousels** (optional per slide). The 3D styles (explainer3d, voxel) keep their own characters.

Trade-off to tell the user once: the drawn presenter aims its arm at any point on screen; an image mascot can only use the poses it
has. The engine picks the closest pose (pointing up / sideways / down, mirrored to the side of the target), so lay out the beat with
the hero up-left or left of the mascot, where its pointing poses aim.

## Make it (once)

Ask once: what it should look like (or a photo / an art-style image to follow), and the style (2D cartoon, voxel, clay, pixel, 3D
toy). A good mascot: one clear style that reads as a thumbnail, ONE signature prop tied to the niche, 2-3 main colours, a short name.
Then say what it costs before generating: one paid image request per sheet variant and per pose (3 sheets + 8 poses = 11 images).

1. **Character sheet** (the mascot's ID): `python3 "$SKILL_DIR/tools/mascot.py" sheet <name> "<look: hair, outfit with colours, prop>" [--style "<art style>"] [--ref style.png] [--variants 3]`
   Open `sheets.jpg`, show it to the user, let them pick: `mascot.py pick <name> <n>`.
2. **Poses**: `mascot.py poses <name>` (default 8: explain, point-side, point-up, point-down, think, shrug, thumbsup, wave; add more
   with `--poses explain,phone,cheer,...` or a custom one `--poses "laptop:typing on a laptop, smiling"`). Each pose is generated from
   the sheet and cut out automatically (flat background removed, enclosed gaps too, edges cleaned, 24 px padding).
3. **Check**: open `poses.jpg` (dark background) and LOOK at every pose: same face and outfit as the sheet, hands, hair, shoes and the
   prop complete, no grey halo. A pose with a changed face: `mascot.py poses <name> --poses <pose> --fix "same face and outfit as the sheet, only change the pose"`.
   A bad cut (shadow left under the feet): `mascot.py recut <name> <pose> --shadow` (or `--tol 22`).
4. **Use it**: `mascot.py use <name>`: every NEW classic reel and carousel gets it (`reel new` copies it into `assets/mascot/`).
   Existing project: `mascot.py install <project>`. Back to the drawn presenter: `mascot.py use drawn`.

**Providers** (`--provider auto|gemini|openrouter`): the Gemini API key needs billing ON (its free tier allows no image models), or
OpenRouter credit. If neither works the tool says so. **Free route**: `mascot.py sheet <name> "<look>" --print-prompts` (and later
`poses <name> --print-prompts`) prints the exact prompts; the user pastes them into the Gemini app (gemini.google.com), uploads the
sheet for each pose, saves the images, then `mascot.py pick <name> <sheet.png>` and `mascot.py add <name> <pose> <image.png>` for each.
`add` also takes any image the user already has (their own drawings, a designer's files).

## Use it in a classic reel

Nothing changes in how scenes are written: `guy(t)` / `act(t, {...})` work as before and the mascot follows them:
- pointing at a target → `point-up` (target high), `point-side`, `point-down` (target low); mirrored when the target is to its right;
- `wave` → wave, `thumb` → thumbsup, `shrug` → shrug, `facepalm`/`cover` → think, `fist` → cheer, `hold`/`frame`/no gesture → explain,
  `shock` → shock; a missing pose falls back to the closest one it has.
- Force a pose for a beat: return `{ ...act(t, {...}), mascot: 'phone' }` (and `mascotFlip: true` to mirror).
- It bobs, nods while the voice speaks and squashes slightly on every new phrase. Size and place in reel.json
  `"mascot": {"height": 820, "lift": 60, "dx": 0, "dock": {"x": 842, "y": 1990, "s": 0.8}}`; `"enabled": false` = drawn presenter again.
- Storyboard: give the mascot a pose per phrase in the `presenter` line (e.g. "think on the question, point-up on the card, thumbsup on the answer").

## Use it in a carousel

Per slide: `mascot: 'point-side'` (any pose name, or `true` = explain) and optionally `mascotFlip: true`, `mascotHeight: 470`.
It stands bottom-right with an idle bob that loops; `box.w` shrinks so the stage keeps clear of it. Use it on 1-3 slides (hook,
the key step, the CTA with `point-down`), not on every slide.

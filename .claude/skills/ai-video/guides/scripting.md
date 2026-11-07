# Scripting: how the reels that got millions of views are written

Use this whenever you write a script. If the user gives you a script, use theirs word for word.

## Shape (110-170 words ≈ 32-50 s)

1. **Hook (first sentence, ≤ 1.5 s to the point).** Name the viewer, the stakes or the surprise. No warm-up, no "Hey guys", no "In this video".
2. **Curiosity loop (sentence 2).** Promise something that only pays off near the end: "and the last one is the reason I stopped paying for X", "there's one step almost everyone skips", "by the end you'll know exactly which one to pick". Close the loop right before the CTA.
3. **Body: the problem felt, then the answer.** Concrete scenes, numbers and examples ("you paste the same error into ChatGPT four times" beats "debugging is hard"). If there's a product or tool, name it only after the viewer feels the problem (around 40-60% in), then say what it does FOR them, not its feature list.
4. **One reframing line** before the ask: the takeaway in one sentence.
5. **CTA (last sentence):** "Comment KEYWORD and I'll send you the link." (or "...the full list", "...the template"). KEYWORD is one uppercase word tied to the topic.

**Runtime:** ≈ words / (3 × voice speed) seconds after the silence cuts (measured: 60 words → 15.7 s, 167 words → 47.3 s at ×1.2).
At the default ×1.15 that's ≈ 3.4 words/s, so 110-170 words ≈ 32-50 s. For a target length, write ≈ seconds × 3 × speed words.

**Shorter scripts** (the user asks for 15-30 s): keep all five parts, compressed, never drop the loop or the payoff. Hook and loop can
share the first sentence ("There's a reason Costco's hot dog has cost $1.50 since 1985, and it's not about the hot dog."), the body
is 1-3 concrete sentences, the payoff line closes the loop, the CTA stays last. 15 s ≈ 50-60 words, 30 s ≈ 100 words.

## Hooks that work (pick a pattern, write it fresh for this topic)
- "Someone just built / open-sourced X that ..."
- "The biggest mistake people make with X is ..."
- "If you're X and you still Y, you're paying for it."
- "Nobody tells you this about X." / "Nobody's talking about X."
- "Stop doing X." / "Here's why your X isn't working."
- "Most people think X. It's actually Y."
- "How to X without Y." / "N signs you ..." / "Steal this X."
- "Wait till you see what X does." / "This is your sign to X."
- "I found the X that ..." / "There's a reason X ..." / "You've been doing X backwards."
- "So someone built X ..." / "Here are the 3 X I'd install first ..."

### Hooks in Portuguese (pt-BR reels)
Write them fresh for the topic, in natural Brazilian Portuguese (você, contractions like "tá", "pra"), never translated word by word:
- "Todo mundo tá fazendo X... e ninguém te conta como."
- "Eu consegui [resultado] sem [habilidade / dinheiro]."
- "Para de fazer X. Faz isso aqui."
- "Você tá usando [ferramenta] do jeito errado."
- "Isso aqui levou [pouco tempo]. Olha como."
- "Ninguém fala desse truque do [ferramenta]."
- "Se você [situação], assiste isso."
- "[Número] [coisas] que [resultado]."
- "O que os [especialistas] não te contam sobre X."
- "Você não precisa de X pra Y."
CTA in Portuguese: "Comenta PALAVRA que eu te mando [o link / a lista / o modelo]." The KEYWORD is one short uppercase Portuguese word, easy to type.

Avoid: "POV:", "Hot take:", "Quick tip:", "The difference between X and Y", "This just came out", open questions as hooks ("Have you ever...?"), time-of-day openers ("It's 9 a.m."), and anything that sounds like an ad in line 1.

## Voice and rhythm
- Conversational and relaxed, like explaining it to a friend. Flowing sentences, contractions.
- Never staccato slogan fragments ("One app. One click. Done.") and never triplet punchlines.
- One idea per sentence. 8-18 words per sentence is the sweet spot for captions.
- Numbers beat adjectives. Specific beats general. "You" beats "people".
- Lists: say the count up front ("three plugins"), then "The first...", "The second...", "And the last one..." so viewers know where they are.
- No corporate words: "leverage", "seamless", "under the hood", "our platform", "game-changer", "revolutionize".

## Emotion tags (ElevenLabs eleven_v4)
After the script is approved, write `script.txt` WITH audio tags: one tag at the start of each sentence or shift in feeling, never on every word.
- Useful tags: `[excited]` (hook, big reveal), `[curious]` (the question or loop), `[warm]` (empathy, the problem felt), `[confident]` (the answer, the CTA), `[whispers]` (a secret), `[laughs softly]` (a light moment). A strong start: `[bold, energetic]`.
- Tags stay in English even in a Portuguese script; they are acted, not spoken. `tts.py` removes them from the captions and `words.json`.
- Spell numbers out as they are spoken ("cento e sete reais"); captions show the words as voiced.
- Read it out loud in your head first: a line you stumble on, the voice stumbles on too. Cut it shorter.

## The script table (show it before voicing)
Before any voice credit is spent, show the user this table in chat and wait for "aprovado" (or their changes):
| # | Fala (exactly as spoken) | Emoção (tag) | Na tela (what appears) | Apresentador (classic: pose/gesture) |
Change only the lines the user names; never rewrite approved lines. Skip the table only when the user said to go straight to the finished reel ("sem aprovação", "pode fazer direto") or pasted their own script and asked for no review.

## Facts
- Only state facts you are sure of or that the user gave you. For product claims, use the product's own wording. If unsure, keep it qualitative.

## Before you finish, check
- [ ] Hook names stakes or a surprise in under 1.5 s
- [ ] Sentence 2 opens a loop that the ending closes
- [ ] The answer/product appears after the problem is felt
- [ ] Every sentence could be shown as ONE clear visual
- [ ] 110-170 words (or the length the user asked for), ends with "Comment KEYWORD ..."
- [ ] Read it out loud in your head: does it sound like a person, not an ad?
- [ ] One emotion tag per sentence or shift at most, in English, inside [brackets]
- [ ] The KEYWORD in the CTA is the same word that will be on screen and in the post caption

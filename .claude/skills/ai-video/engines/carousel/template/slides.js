// One entry per slide. title: *palavra* = the accent word (moves in its own loop: accentMove bob | wave | tilt | pulse | slide).
// stage(g, lt, T, K, box): the moving visual, lt = 0..slideSeconds. Every change must be multiplied by T.rest(lt) (or use T.span)
// so the slide ends exactly as it started; idle motion uses T.float / T.wave (seamless). See guides/styles/carousel.md.
window.SLIDES = [
  {
    title: 'Este carrossel *se mexe*', text: 'Cada slide é um vídeo que se repete. Veja →', accentMove: 'wave',
    stage(g, lt, T, K, box) {
      const cx = box.x + box.w / 2, cy = box.y + 320;
      for (let k = 0; k < 5; k++) {                       // a fan of mini slides that shifts one place and settles back
        const sh = T.span(lt, 0.4, 2.6), a = (k - 2) * 0.16 + sh * 0.05, x = cx + (k - 2) * 120;
        g.save(); g.translate(x, cy + Math.abs(k - 2) * 26 + T.float(lt, 3, 1, k * 0.2)); g.rotate(a);
        K.card(-120, -160, 240, 300, { r: 14 }); K.lines(-90, -100, 180, 4, { seed: k + 1, gap: 34 });
        K.text(-90, -140, `0${k + 1}`, { size: 22, fam: K.FAM.mono, color: K.TH.accent }); g.restore();
      }
      K.arrow(cx + 330, cy + 200, cx + 420 + T.float(lt, 8, 2), cy + 120, 1, { bend: -0.3 });
    },
  },
  {
    label: 'passo 1', title: 'Copie o *formato*', text: 'Salve 3 carrosséis do seu nicho que você ama.', accentMove: 'bob',
    stage(g, lt, T, K, box) {
      const p = T.span(lt, 0.5, 1.4);
      K.window(box.x + 60, box.y + 40, 520, 520, 'referências', (g, w, h) => K.lines(30, 40, w - 60, 9, { seed: 4, gap: 46 }));
      K.circle(box.x + 320, box.y + 300, 230, 120, p);
      K.note(box.x + 610, box.y + 200 + T.float(lt, 4), 'este aqui', { size: 44, p: T.span(lt, 1.2, 1.8) * 1 });
      K.stamp(box.x + 720, box.y + 420, 'salvo ✓', { p: T.span(lt, 1.8, 2.3), rot: 6 });
    },
  },
  {
    label: 'o fim', title: 'Quer o *passo a passo*?', text: 'Comenta CARROSSEL que eu te mando o guia.', accentMove: 'pulse',
    stage(g, lt, T, K, box) {
      const word = 'CARROSSEL', typed = K.type(word, T.span(lt, 0.3, 1.3));
      K.card(box.x + 120, box.y + 120, 700, 110, { r: 55 });
      K.text(box.x + 170, box.y + 158, typed || 'Adicione um comentário...', { size: 36, color: typed ? K.TH.ink : '#A9A69E', fam: K.FAM.sans });
      K.chip(box.x + 690, box.y + 152, 'Publicar', { fill: K.TH.mark, color: K.TH.onMark, scale: 1 + 0.15 * T.span(lt, 1.4, 1.6) * (1 - T.seg(lt, 1.6, 1.9)) });
      const dm = T.span(lt, 1.9, 2.4);
      g.save(); g.globalAlpha = dm; g.translate(0, (1 - dm) * 30);
      K.card(box.x + 200, box.y + 300, 560, 180, { r: 28 }); K.text(box.x + 240, box.y + 340, 'aqui está o seu guia', { size: 36, wt: 600 });
      K.chip(box.x + 240, box.y + 400, 'guia completo ↗'); g.restore();
      K.circle(box.x + 480, box.y + 390, 320, 130, T.span(lt, 2.4, 3.0));
    },
  },
];
